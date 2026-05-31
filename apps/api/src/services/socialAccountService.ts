import {
  Prisma,
  type SocialAccessMethod,
  type SocialAccountStatus,
  type SocialPlatform,
} from '@prisma/client';
import { db } from '../lib/db.js';
import { HttpError } from '../middleware/error.js';
import { encryptSecret, isVaultEnabled } from '../lib/crypto.js';

/**
 * Client-facing social-account operations. All reads/writes go through the
 * tenant-scoped `db` client (SocialAccount is in TENANT_SCOPED), so a client
 * only ever touches their own rows.
 *
 * CRITICAL: `secretCiphertext` is never selected here and never returned to a
 * client. PUBLIC_SELECT is the only projection used on this surface; the
 * encrypted secret is reachable solely via the admin reveal path.
 */

const PUBLIC_SELECT = {
  id: true,
  tenantId: true,
  platform: true,
  handle: true,
  accessMethod: true,
  status: true,
  secretUpdatedAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SocialAccountSelect;

type PublicRow = Prisma.SocialAccountGetPayload<{ select: typeof PUBLIC_SELECT }>;

/** Client view — derives `hasCredentials`, never exposes the ciphertext. */
function toClientView(row: PublicRow) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    platform: row.platform,
    handle: row.handle,
    accessMethod: row.accessMethod,
    status: row.status,
    hasCredentials: row.secretUpdatedAt !== null,
    secretUpdatedAt: row.secretUpdatedAt ? row.secretUpdatedAt.toISOString() : null,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listSocialAccounts() {
  const rows = await db.socialAccount.findMany({
    select: PUBLIC_SELECT,
    orderBy: { createdAt: 'asc' },
  });
  return rows.map(toClientView);
}

interface CreateInput {
  tenantId: string;
  platform: SocialPlatform;
  handle?: string | undefined;
  accessMethod: SocialAccessMethod;
  notes?: string | undefined;
}

export async function createSocialAccount(input: CreateInput) {
  try {
    const row = await db.socialAccount.create({
      data: {
        tenantId: input.tenantId,
        platform: input.platform,
        handle: input.handle ?? null,
        accessMethod: input.accessMethod,
        notes: input.notes ?? null,
        // status defaults to `pending`; credentials are set via the separate
        // /credentials endpoint, never at create time.
      },
      select: PUBLIC_SELECT,
    });
    return toClientView(row);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new HttpError(409, 'An account for this platform already exists.', 'ACCOUNT_EXISTS');
    }
    throw err;
  }
}

interface UpdateInput {
  handle?: string | undefined;
  status?: SocialAccountStatus | undefined;
  notes?: string | undefined;
  accessMethod?: SocialAccessMethod | undefined;
}

export async function updateSocialAccount(id: string, input: UpdateInput) {
  // findFirst (not findUnique) so the scope extension AND-wraps tenantId — a
  // cross-tenant id resolves to null → 404.
  const existing = await db.socialAccount.findFirst({
    where: { id },
    select: { id: true },
  });
  if (!existing) throw new HttpError(404, 'not_found', 'not_found');

  const data: Prisma.SocialAccountUpdateInput = {};
  if (input.handle !== undefined) data.handle = input.handle;
  if (input.status !== undefined) data.status = input.status;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.accessMethod !== undefined) {
    data.accessMethod = input.accessMethod;
    // Switching away from `credentials` wipes any stored secret.
    if (input.accessMethod !== 'credentials') {
      data.secretCiphertext = null;
      data.secretUpdatedAt = null;
    }
  }

  const row = await db.socialAccount.update({ where: { id }, data, select: PUBLIC_SELECT });
  return toClientView(row);
}

export async function setSocialAccountCredentials(id: string, username: string, password: string) {
  if (!isVaultEnabled()) {
    throw new HttpError(503, 'Credential storage is currently unavailable.', 'vault_unavailable');
  }

  const existing = await db.socialAccount.findFirst({
    where: { id },
    select: { id: true, accessMethod: true },
  });
  if (!existing) throw new HttpError(404, 'not_found', 'not_found');
  if (existing.accessMethod !== 'credentials') {
    throw new HttpError(
      400,
      'This account is not set to use stored credentials.',
      'WRONG_ACCESS_METHOD',
    );
  }

  // AAD binds the ciphertext to this row so it can't be replayed into another.
  const secretCiphertext = encryptSecret(`${username}:${password}`, existing.id);
  const secretUpdatedAt = new Date();
  await db.socialAccount.update({
    where: { id },
    data: { secretCiphertext, secretUpdatedAt, status: 'active' },
  });

  // Never return the ciphertext or plaintext — just confirmation + timestamp.
  return { success: true as const, secretUpdatedAt: secretUpdatedAt.toISOString() };
}

export async function removeSocialAccount(id: string) {
  const existing = await db.socialAccount.findFirst({ where: { id }, select: { id: true } });
  if (!existing) throw new HttpError(404, 'not_found', 'not_found');

  // Wipe the secret in a committed update before removing the row (defense in
  // depth — the secret is NULLed even if a row tombstone ever lingered).
  await db.socialAccount.update({
    where: { id },
    data: { secretCiphertext: null, secretUpdatedAt: null },
  });
  await db.socialAccount.delete({ where: { id } });
}
