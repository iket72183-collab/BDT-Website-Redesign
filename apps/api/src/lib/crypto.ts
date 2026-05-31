import crypto from 'node:crypto';
import { config } from '../config/env.js';

/**
 * Reversible secret encryption for the social-account credential vault.
 *
 * AES-256-GCM envelope. The master key comes from config.socialVault (a
 * secret-store key today). The `v1:gcm:` prefix is a deliberate seam: a future
 * `v2:kms:` variant backed by a cloud KMS can be added and decryptSecret will
 * dispatch on the prefix — no data migration, old envelopes keep decrypting.
 *
 * GCM is authenticated, so tampering with the ciphertext is detected on
 * decrypt. The owning record id is bound as AAD so a ciphertext lifted from one
 * row can't be replayed into another.
 *
 * THIS IS NOT PASSWORD HASHING. These secrets are recoverable by design (BDT
 * has to log into the client's accounts). The protection model is: key kept out
 * of the DB/code, authenticated encryption at rest, strict access-control +
 * audit at the service layer, and never returning the plaintext to the client.
 */

const VERSION = 'v1';
const ALGO = 'gcm';
const CIPHER = 'aes-256-gcm';
const IV_BYTES = 12; // GCM standard 96-bit nonce

/** Thrown when an encrypt/decrypt is attempted with no master key configured. */
export class VaultDisabledError extends Error {
  constructor() {
    super('social_vault_disabled');
    this.name = 'VaultDisabledError';
  }
}

function requireKey(): Buffer {
  const key = config.socialVault.key;
  if (!key) throw new VaultDisabledError();
  return key;
}

/** True when a master key is configured — callers gate credential storage on this. */
export function isVaultEnabled(): boolean {
  return config.socialVault.enabled;
}

/**
 * Encrypt a secret into a compact, self-describing envelope:
 * `v1:gcm:<iv>:<tag>:<ciphertext>` (each part base64url).
 *
 * @param plaintext the secret to protect
 * @param aad optional additional authenticated data — pass the owning record
 *   id so the ciphertext is cryptographically bound to that row.
 */
export function encryptSecret(plaintext: string, aad?: string): string {
  const key = requireKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(CIPHER, key, iv);
  if (aad) cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    ALGO,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':');
}

/**
 * Decrypt an envelope produced by encryptSecret. `aad` must match what was used
 * at encrypt time. Throws if the key is wrong, the data was tampered with, or
 * the aad doesn't match (all surface as GCM auth failures).
 */
export function decryptSecret(envelope: string, aad?: string): string {
  const key = requireKey();
  const parts = envelope.split(':');
  if (parts.length !== 5) throw new Error('vault_envelope_malformed');
  const [version, algo, ivB64, tagB64, dataB64] = parts as [
    string,
    string,
    string,
    string,
    string,
  ];
  if (version !== VERSION || algo !== ALGO) {
    throw new Error(`vault_envelope_unsupported:${version}:${algo}`);
  }
  const decipher = crypto.createDecipheriv(CIPHER, key, Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  if (aad) decipher.setAAD(Buffer.from(aad, 'utf8'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64url')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}
