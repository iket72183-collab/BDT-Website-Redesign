import bcrypt from 'bcrypt';
import { rawPrisma } from '../lib/db.js';
import { USER_PUBLIC } from '../lib/userSelect.js';
import type { AuthClaims } from '../middleware/verifyToken.js';
import { HttpError } from '../middleware/error.js';
import { logger } from '../lib/logger.js';
import { logEvent } from './platformEventService.js';
import {
  consumeActionToken,
  issueAccessToken,
  issueActionToken,
  issueRefreshToken,
  revokeAllForUser,
  revokeRefreshToken,
  rotateRefreshToken,
  type RefreshMeta,
} from './tokenService.js';
import {
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
} from './notificationService.js';
import type { RegisterInput, LoginInput } from '../validators/auth.validators.js';

const BCRYPT_ROUNDS = 12;

export interface AuthResult {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    tenantId: string | null;
    emailVerifiedAt: Date | null;
  };
  accessToken: string;
  refreshToken: string;
}

// ---------------------------------------------------------------------------
// Register — new agency client signup. Creates the tenant + client user
// atomically, then fires an email-verification message. Subscription /
// onboarding flow continues on the mobile side (plan selection → payment).
// ---------------------------------------------------------------------------

export async function register(input: RegisterInput, meta: RefreshMeta = {}): Promise<AuthResult> {
  const existing = await rawPrisma.tenant.findUnique({ where: { slug: input.tenant.slug } });
  if (existing) throw new HttpError(409, 'slug_taken', 'slug_taken');

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  const { tenant, user } = await rawPrisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        slug: input.tenant.slug,
        businessName: input.tenant.businessName,
        ...(input.tenant.businessType ? { businessType: input.tenant.businessType } : {}),
        subscriptionStatus: 'incomplete',
        onboardingCompleted: false,
      },
    });
    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone ?? null,
        role: 'client',
        notificationPreference: { create: { tenantId: tenant.id } },
      },
    });
    await tx.tenant.update({ where: { id: tenant.id }, data: { ownerId: user.id } });
    return { tenant, user };
  });

  await logEvent('tenant.created', { tenantId: tenant.id, slug: tenant.slug });
  await logEvent('user.registered', { userId: user.id, role: user.role });

  // Best-effort verify email — never block the signup response on transport failure.
  await dispatchEmailVerification(user.id, user.email, user.firstName, tenant.slug).catch((err) =>
    logger.error({ err, userId: user.id }, 'register.verify_email_dispatch_failed'),
  );

  return mintSession({ sub: user.id, role: user.role, tenantId: tenant.id }, meta, user);
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export async function login(input: LoginInput, meta: RefreshMeta = {}): Promise<AuthResult> {
  const where = input.tenantSlug
    ? { tenant: { slug: input.tenantSlug }, email: input.email }
    : { email: input.email, role: 'platform_admin' as const };

  const user = await rawPrisma.user.findFirst({ where, include: { tenant: true } });
  if (!user || !user.isActive) throw new HttpError(401, 'invalid_credentials', 'invalid_credentials');

  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) throw new HttpError(401, 'invalid_credentials', 'invalid_credentials');

  await logEvent('user.login', { userId: user.id });

  return mintSession({ sub: user.id, role: user.role, tenantId: user.tenantId }, meta, user);
}

// ---------------------------------------------------------------------------
// Refresh — rotate. tokenService handles reuse detection (replay attempt
// against a revoked jti revokes ALL of the user's sessions).
// ---------------------------------------------------------------------------

export async function refresh(rawRefreshToken: string, meta: RefreshMeta = {}): Promise<AuthResult> {
  const { claims, refreshToken } = await rotateRefreshToken(rawRefreshToken, meta);

  const user = await rawPrisma.user.findUnique({ where: { id: claims.sub } });
  if (!user) throw new HttpError(401, 'invalid_refresh', 'invalid_refresh');

  return {
    user: pickUser(user, claims.tenantId),
    accessToken: issueAccessToken(claims),
    refreshToken,
  };
}

// ---------------------------------------------------------------------------
// Logout — revoke just this session's refresh token. Best-effort.
// ---------------------------------------------------------------------------

export async function logout(rawRefreshToken: string | undefined): Promise<void> {
  if (rawRefreshToken) await revokeRefreshToken(rawRefreshToken);
  await logEvent('user.logout');
}

// ---------------------------------------------------------------------------
// /me
// ---------------------------------------------------------------------------

export async function me(userId: string) {
  // Select-shape (not `include`) — this is what guarantees passwordHash never
  // leaks into a /me response. If you find yourself reaching for `include`,
  // add the field to USER_PUBLIC instead.
  const user = await rawPrisma.user.findUnique({
    where: { id: userId },
    select: {
      ...USER_PUBLIC,
      tenant: {
        select: {
          id: true,
          slug: true,
          businessName: true,
          brandColor: true,
          logoUrl: true,
          subscriptionTier: true,
          subscriptionStatus: true,
          onboardingCompleted: true,
        },
      },
    },
  });
  if (!user) throw new HttpError(404, 'not_found', 'not_found');
  return user;
}

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

/**
 * Issue + email a reset link. The route always returns 200 success so we
 * never leak whether the address has an account here.
 */
export async function forgotPassword(email: string, tenantSlug?: string): Promise<void> {
  await logEvent('user.forgot_password_requested', { email, tenantSlug: tenantSlug ?? null });

  const where = tenantSlug
    ? { tenant: { slug: tenantSlug }, email }
    : { email, role: 'platform_admin' as const };

  const user = await rawPrisma.user.findFirst({
    where,
    select: {
      id: true,
      email: true,
      firstName: true,
      isActive: true,
      tenant: { select: { slug: true } },
    },
  });
  if (!user || !user.isActive) return; // silent no-op (anti-enumeration)

  const rawToken = await issueActionToken(user.id, 'password_reset');
  try {
    await sendPasswordResetEmail({
      to: user.email,
      firstName: user.firstName,
      rawToken,
      tenantSlug: user.tenant?.slug ?? null,
    });
  } catch (err) {
    logger.error({ err, userId: user.id }, 'forgot_password.email_failed');
  }
}

/**
 * Redeem the reset token + set the new password. Revokes every refresh
 * token for the user so other devices are forced to log in again.
 */
export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const { userId } = await consumeActionToken(rawToken, 'password_reset');
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await rawPrisma.user.update({ where: { id: userId }, data: { passwordHash } });
  await revokeAllForUser(userId);
  await logEvent('user.password_reset', { userId });
}

// ---------------------------------------------------------------------------
// Email verification
// ---------------------------------------------------------------------------

/**
 * Resend the verification email — idempotent. `issueActionToken` invalidates
 * any prior unconsumed token for this purpose, so only the newest link works.
 */
export async function resendEmailVerification(userId: string): Promise<void> {
  const user = await rawPrisma.user.findUnique({
    where: { id: userId },
    include: { tenant: { select: { slug: true } } },
  });
  if (!user) throw new HttpError(404, 'not_found', 'not_found');
  if (user.emailVerifiedAt) return; // already verified — no-op
  await dispatchEmailVerification(user.id, user.email, user.firstName, user.tenant?.slug ?? null);
}

/**
 * Redeem an email-verify token. The bearer's userId MUST match the token's
 * — prevents someone else's leaked link from confirming your address.
 */
export async function verifyEmail(rawToken: string, bearerUserId: string): Promise<void> {
  const { userId } = await consumeActionToken(rawToken, 'email_verify');
  if (userId !== bearerUserId) {
    throw new HttpError(403, 'token_user_mismatch', 'token_user_mismatch');
  }
  await rawPrisma.user.update({
    where: { id: userId },
    data: { emailVerifiedAt: new Date() },
  });
  await logEvent('user.email_verified', { userId });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function dispatchEmailVerification(
  userId: string,
  email: string,
  firstName: string,
  tenantSlug: string | null,
): Promise<void> {
  const rawToken = await issueActionToken(userId, 'email_verify');
  await sendEmailVerificationEmail({ to: email, firstName, rawToken, tenantSlug });
}

async function mintSession(
  claims: AuthClaims,
  meta: RefreshMeta,
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    tenantId: string | null;
    emailVerifiedAt: Date | null;
  },
): Promise<AuthResult> {
  const accessToken = issueAccessToken(claims);
  const refreshToken = await issueRefreshToken(claims, meta);
  return { user: pickUser(user, claims.tenantId), accessToken, refreshToken };
}

function pickUser(
  u: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    emailVerifiedAt: Date | null;
  },
  tenantId: string | null,
): AuthResult['user'] {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
    tenantId,
    emailVerifiedAt: u.emailVerifiedAt,
  };
}
