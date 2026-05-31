import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Credential-vault crypto: AES-256-GCM envelope encryption.
 *
 * Coverage:
 *   - round-trips plaintext (with and without AAD)
 *   - emits the versioned `v1:gcm:` envelope
 *   - fresh random IV per call → identical plaintext yields different ciphertext
 *   - authenticated: tampered ciphertext, wrong AAD, and wrong key all fail
 *   - disabled vault (no key) throws VaultDisabledError
 *
 * config is mocked with a mutable key so we can exercise the wrong-key and
 * disabled paths without touching real env.
 */

const { configMock, KEY_A, KEY_B } = vi.hoisted(() => {
  const KEY_A = Buffer.alloc(32, 7);
  const KEY_B = Buffer.alloc(32, 9);
  return {
    KEY_A,
    KEY_B,
    configMock: { socialVault: { enabled: true, key: KEY_A as Buffer | null } },
  };
});

vi.mock('../../config/env.js', () => ({ config: configMock }));

import { encryptSecret, decryptSecret, isVaultEnabled, VaultDisabledError } from '../crypto.js';

beforeEach(() => {
  configMock.socialVault.enabled = true;
  configMock.socialVault.key = KEY_A;
});

describe('encryptSecret / decryptSecret', () => {
  it('round-trips a secret', () => {
    const env = encryptSecret('hunter2-correct-horse');
    expect(decryptSecret(env)).toBe('hunter2-correct-horse');
  });

  it('emits a versioned v1:gcm envelope with five parts', () => {
    const env = encryptSecret('x');
    expect(env.startsWith('v1:gcm:')).toBe(true);
    expect(env.split(':')).toHaveLength(5);
  });

  it('uses a fresh IV each call (same plaintext → different ciphertext)', () => {
    expect(encryptSecret('same')).not.toBe(encryptSecret('same'));
  });

  it('round-trips with matching AAD', () => {
    const env = encryptSecret('s3cret', 'account_123');
    expect(decryptSecret(env, 'account_123')).toBe('s3cret');
  });

  it('rejects a mismatched AAD', () => {
    const env = encryptSecret('s3cret', 'account_123');
    expect(() => decryptSecret(env, 'account_999')).toThrow();
  });

  it('rejects AAD when none was used at encrypt time', () => {
    const env = encryptSecret('s3cret');
    expect(() => decryptSecret(env, 'account_123')).toThrow();
  });

  it('detects tampering with the ciphertext', () => {
    const env = encryptSecret('s3cret');
    const parts = env.split(':');
    // Flip a character in the ciphertext segment.
    const data = parts[4]!;
    parts[4] = (data[0] === 'A' ? 'B' : 'A') + data.slice(1);
    expect(() => decryptSecret(parts.join(':'))).toThrow();
  });

  it('fails to decrypt with a different key', () => {
    const env = encryptSecret('s3cret');
    configMock.socialVault.key = KEY_B;
    expect(() => decryptSecret(env)).toThrow();
  });

  it('rejects a malformed envelope', () => {
    expect(() => decryptSecret('not-a-valid-envelope')).toThrow('vault_envelope_malformed');
  });

  it('rejects an unsupported version/algo', () => {
    const env = encryptSecret('s3cret');
    const swapped = env.replace(/^v1:gcm:/, 'v2:kms:');
    expect(() => decryptSecret(swapped)).toThrow(/vault_envelope_unsupported/);
  });
});

describe('vault enablement', () => {
  it('reports enabled when a key is present', () => {
    expect(isVaultEnabled()).toBe(true);
  });

  it('throws VaultDisabledError when no key is configured', () => {
    configMock.socialVault.enabled = false;
    configMock.socialVault.key = null;
    expect(isVaultEnabled()).toBe(false);
    expect(() => encryptSecret('x')).toThrow(VaultDisabledError);
    expect(() => decryptSecret('v1:gcm:a:b:c')).toThrow(VaultDisabledError);
  });
});
