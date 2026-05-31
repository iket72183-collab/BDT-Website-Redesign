import { Prisma, type SocialAccountStatus, type SocialPlatform } from '@prisma/client';
import { rawPrisma } from '../lib/db.js';
import { HttpError } from '../middleware/error.js';
import { logEvent } from './platformEventService.js';
import { decryptSecret } from '../lib/crypto.js';

/**
 * Platform-admin social-account operations. Runs in the runAsPlatform() context
 * (rawPrisma, cross-tenant). The list path joins the tenant for the admin table
 * and never selects the ciphertext; the reveal path is the ONLY place plaintext
 * credentials are produced, and it always writes an audit event first.
 */

const ADMIN_SELECT = {
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
  tenant: { select: { id: true, businessName: true, subscriptionTier: true } },
} satisfies Prisma.SocialAccountSelect;

interface AdminListInput {
  page: number;
  limit: number;
  tenantId?: string | undefined;
  platform?: SocialPlatform | undefined;
  status?: SocialAccountStatus | undefined;
}

export async function adminListSocialAccounts(input: AdminListInput) {
  const where: Prisma.SocialAccountWhereInput = {};
  if (input.tenantId) where.tenantId = input.tenantId;
  if (input.platform) where.platform = input.platform;
  if (input.status) where.status = input.status;

  const [rows, total] = await rawPrisma.$transaction([
    rawPrisma.socialAccount.findMany({
      where,
      select: ADMIN_SELECT,
      orderBy: { createdAt: 'desc' },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
    rawPrisma.socialAccount.count({ where }),
  ]);
  return { rows, total };
}

/**
 * Decrypt and return a client's stored login. The ONLY path that produces
 * plaintext credentials. Writes a `credentials_revealed` audit event BEFORE
 * returning, so every access is recorded even if the caller drops the response.
 */
export async function revealCredentials(id: string, adminUserId: string) {
  const account = await rawPrisma.socialAccount.findUnique({
    where: { id },
    select: { id: true, tenantId: true, platform: true, handle: true, secretCiphertext: true },
  });
  if (!account) throw new HttpError(404, 'not_found', 'not_found');
  if (!account.secretCiphertext) {
    throw new HttpError(404, 'No stored credentials for this account.', 'NO_CREDENTIALS');
  }

  const plaintext = decryptSecret(account.secretCiphertext, account.id);
  // Split on the FIRST colon only — a password may itself contain colons.
  const idx = plaintext.indexOf(':');
  const username = idx === -1 ? plaintext : plaintext.slice(0, idx);
  const password = idx === -1 ? '' : plaintext.slice(idx + 1);

  await logEvent('credentials_revealed', {
    adminUserId,
    socialAccountId: account.id,
    tenantId: account.tenantId,
    platform: account.platform,
    revealedAt: new Date().toISOString(),
  });

  return { username, password, platform: account.platform, handle: account.handle };
}

export async function adminUpdateSocialAccountStatus(id: string, status: SocialAccountStatus) {
  // Unknown id → Prisma P2025 → 404 via the global error handler.
  return rawPrisma.socialAccount.update({
    where: { id },
    data: { status },
    select: ADMIN_SELECT,
  });
}
