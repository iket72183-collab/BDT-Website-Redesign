import crypto from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { AuthTokenPurpose } from '@prisma/client';
import { rawPrisma } from '../lib/db.js';
import { config } from '../config/env.js';
import { HttpError } from '../middleware/error.js';
import { logger } from '../lib/logger.js';
import type { AuthClaims } from '../middleware/verifyToken.js';

// =============================================================================
// Access tokens — stateless JWT
// =============================================================================

/**
 * Token type discriminator. Burned into the JWT body so a refresh token
 * presented to the access-token verifier — or vice versa — gets rejected
 * even if the signing key is shared. Verifiers must check this field
 * after the signature passes.
 */
export type TokenType = 'access' | 'refresh';

const COMMON_JWT_OPTS = {
  issuer: config.jwt.issuer,
  audience: config.jwt.audience,
} as const;

export function issueAccessToken(claims: AuthClaims): string {
  return jwt.sign(
    { ...claims, tokenType: 'access' satisfies TokenType },
    config.jwt.accessSecret,
    {
      ...COMMON_JWT_OPTS,
      expiresIn: config.jwt.accessTtl as NonNullable<SignOptions['expiresIn']>,
    },
  );
}

// =============================================================================
// Refresh tokens — JWT + server-side allowlist (rotate on every use)
// =============================================================================

const REFRESH_TTL_MS = parseTtlToMs(config.jwt.refreshTtl);

export interface RefreshMeta {
  userAgent?: string | undefined;
  ip?: string | undefined;
}

/** Issue a fresh refresh token + write the allowlist row. */
export async function issueRefreshToken(claims: AuthClaims, meta: RefreshMeta = {}): Promise<string> {
  const jti = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  await rawPrisma.refreshToken.create({
    data: {
      userId: claims.sub,
      tenantId: claims.tenantId,
      jti,
      expiresAt,
      userAgent: meta.userAgent ?? null,
      ip: meta.ip ?? null,
    },
  });
  return jwt.sign(
    { ...claims, jti, tokenType: 'refresh' satisfies TokenType },
    config.jwt.refreshSecret,
    {
      ...COMMON_JWT_OPTS,
      expiresIn: config.jwt.refreshTtl as NonNullable<SignOptions['expiresIn']>,
    },
  );
}

export interface RotateResult {
  claims: AuthClaims;
  refreshToken: string;
}

/**
 * Verify a refresh token and rotate it:
 *   - JWT signature must be valid + not expired
 *   - jti must exist in the allowlist, not revoked, not expired
 *   - On success: mark old row revoked, mint new jti + new JWT, link via replacedByJti
 *
 * Reuse detection: if the presented jti is already `revokedAt != null`, that
 * means someone is replaying an old cookie — revoke ALL refresh tokens for
 * the user to force a fresh login.
 */
export async function rotateRefreshToken(raw: string, meta: RefreshMeta = {}): Promise<RotateResult> {
  let decoded: AuthClaims & { jti: string; tokenType?: TokenType };
  try {
    decoded = jwt.verify(raw, config.jwt.refreshSecret, {
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    }) as AuthClaims & { jti: string; tokenType?: TokenType };
  } catch {
    throw new HttpError(401, 'invalid_refresh', 'invalid_refresh');
  }

  // tokenType check: an access token presented here would otherwise pass the
  // signature check (if secrets are still shared during transition) and be
  // accepted as a refresh — letting an attacker with an access token extend
  // a session. Reject anything that isn't explicitly a refresh.
  if (decoded.tokenType !== undefined && decoded.tokenType !== 'refresh') {
    throw new HttpError(401, 'invalid_token_type', 'invalid_token_type');
  }

  const row = await rawPrisma.refreshToken.findUnique({ where: { jti: decoded.jti } });

  // Unknown jti — either the secret leaked + someone forged, OR the row was
  // wiped. Either way, fail closed AND revoke everything for the user.
  if (!row) {
    await revokeAllForUser(decoded.sub);
    logger.warn({ userId: decoded.sub, jti: decoded.jti }, 'refresh.unknown_jti');
    throw new HttpError(401, 'token_reuse_detected', 'token_reuse_detected');
  }

  if (row.expiresAt < new Date()) {
    throw new HttpError(401, 'token_expired', 'token_expired');
  }

  // Re-load the user so the new token reflects current role/tenant + isActive.
  const user = await rawPrisma.user.findUnique({ where: { id: decoded.sub } });
  if (!user || !user.isActive) {
    throw new HttpError(401, 'invalid_refresh', 'invalid_refresh');
  }

  const newJti = crypto.randomUUID();
  const newExpiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  const newClaims: AuthClaims = { sub: user.id, role: user.role, tenantId: user.tenantId };

  const rotated = await rawPrisma.$transaction(async (tx) => {
    const claimed = await tx.refreshToken.updateMany({
      where: {
        jti: decoded.jti,
        userId: decoded.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { revokedAt: new Date(), replacedByJti: newJti },
    });
    if (claimed.count !== 1) return false;
    await tx.refreshToken.create({
      data: {
        userId: user.id,
        tenantId: user.tenantId,
        jti: newJti,
        expiresAt: newExpiresAt,
        userAgent: meta.userAgent ?? null,
        ip: meta.ip ?? null,
      },
    });
    return true;
  });

  if (!rotated) {
    await revokeAllForUser(decoded.sub);
    logger.warn({ userId: decoded.sub, jti: decoded.jti }, 'refresh.replay_detected');
    throw new HttpError(401, 'token_reuse_detected', 'token_reuse_detected');
  }

  const newRefreshToken = jwt.sign(
    { ...newClaims, jti: newJti, tokenType: 'refresh' satisfies TokenType },
    config.jwt.refreshSecret,
    {
      ...COMMON_JWT_OPTS,
      expiresIn: config.jwt.refreshTtl as NonNullable<SignOptions['expiresIn']>,
    },
  );

  return { claims: newClaims, refreshToken: newRefreshToken };
}

/** Revoke a specific refresh token. Silently no-ops on invalid input. */
export async function revokeRefreshToken(raw: string): Promise<void> {
  try {
    const decoded = jwt.verify(raw, config.jwt.refreshSecret, {
      ignoreExpiration: true,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    }) as { jti?: string };
    if (!decoded.jti) return;
    await rawPrisma.refreshToken.updateMany({
      where: { jti: decoded.jti, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch {
    // Bad token — nothing to revoke. Logout is best-effort.
  }
}

/**
 * Revoke every active refresh token for a user — call after password reset,
 * email-change, or detected reuse. Forces all devices to log in again.
 */
export async function revokeAllForUser(userId: string): Promise<void> {
  await rawPrisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// =============================================================================
// One-time action tokens (password reset, email verify)
// =============================================================================

/**
 * The raw token is what we email the user. Only the sha256 hash is stored,
 * so a DB leak doesn't immediately expose live reset links.
 */
const TTL_MS_BY_PURPOSE: Record<AuthTokenPurpose, number> = {
  password_reset: 60 * 60 * 1000,        // 1 hour
  email_verify:   24 * 60 * 60 * 1000,   // 24 hours
};

export async function issueActionToken(
  userId: string,
  purpose: AuthTokenPurpose,
): Promise<string> {
  const raw = crypto.randomBytes(32).toString('base64url');
  const tokenHash = sha256(raw);
  const expiresAt = new Date(Date.now() + TTL_MS_BY_PURPOSE[purpose]);

  // Invalidate any prior unused tokens for the same (userId, purpose) so only
  // the most recent emailed link works. Stops a user from accumulating live
  // reset links if they hit "Forgot password" repeatedly.
  await rawPrisma.$transaction([
    rawPrisma.authToken.updateMany({
      where: { userId, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    rawPrisma.authToken.create({
      data: { userId, purpose, tokenHash, expiresAt },
    }),
  ]);

  return raw;
}

/**
 * Look up + consume a one-time token. Returns the userId on success.
 * Throws 400 on any failure (unknown / consumed / expired / wrong purpose)
 * with the same generic error so callers can't enumerate state.
 */
export async function consumeActionToken(
  raw: string,
  purpose: AuthTokenPurpose,
): Promise<{ userId: string }> {
  const tokenHash = sha256(raw);
  const row = await rawPrisma.authToken.findUnique({ where: { tokenHash } });
  if (!row || row.purpose !== purpose) {
    throw new HttpError(400, 'invalid_token', 'invalid_token');
  }
  if (row.consumedAt) {
    throw new HttpError(400, 'token_already_used', 'token_already_used');
  }
  if (row.expiresAt < new Date()) {
    throw new HttpError(400, 'token_expired', 'token_expired');
  }
  await rawPrisma.authToken.update({
    where: { id: row.id },
    data: { consumedAt: new Date() },
  });
  return { userId: row.userId };
}

// =============================================================================
// helpers
// =============================================================================

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/** Parse `"15m" | "30d" | "1h"` → ms. Matches the subset jsonwebtoken accepts. */
function parseTtlToMs(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) throw new Error(`Invalid TTL format: ${ttl}`);
  const n = Number(match[1]);
  switch (match[2]) {
    case 's': return n * 1000;
    case 'm': return n * 60 * 1000;
    case 'h': return n * 60 * 60 * 1000;
    case 'd': return n * 24 * 60 * 60 * 1000;
    default:  throw new Error(`Invalid TTL unit: ${match[2]}`);
  }
}
