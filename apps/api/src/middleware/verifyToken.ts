import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { HttpError } from './error.js';
import type { UserRole } from '@prisma/client';

export interface AuthClaims {
  sub: string;          // user id
  role: UserRole;
  tenantId: string | null; // null for platform_admin
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthClaims;
    }
  }
}

/**
 * Validate the access token from the `Authorization: Bearer …` header
 * and attach the decoded claims to `req.auth`. Throws 401 on missing /
 * invalid / expired tokens — the global error handler turns this into
 * a consistent `{ success: false, error, code }` envelope.
 *
 * Token-type check: even with a matching signature, a refresh token must
 * NOT pass as an access token. tokenService stamps `tokenType: 'access' |
 * 'refresh'` into every JWT body; we enforce 'access' here so a stolen
 * refresh cookie value pasted into an `Authorization` header can't be
 * used to call protected endpoints. iss + aud are also verified —
 * jsonwebtoken throws if either mismatches.
 */
export const verifyToken: RequestHandler = (req, _res, next) => {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new HttpError(401, 'unauthorized', 'missing_token');
  }
  const token = header.slice('Bearer '.length);
  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret, {
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    }) as AuthClaims & { tokenType?: 'access' | 'refresh' };

    // tokenType is undefined on legacy tokens issued before the discriminator
    // was added — accept them once during transition. Once everyone has a
    // fresh access token (15-minute TTL), drop the undefined branch and
    // require 'access' strictly.
    if (decoded.tokenType !== undefined && decoded.tokenType !== 'access') {
      throw new HttpError(401, 'invalid_token_type', 'invalid_token_type');
    }

    req.auth = { sub: decoded.sub, role: decoded.role, tenantId: decoded.tenantId };
    next();
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (err instanceof jwt.TokenExpiredError) {
      // Specific code so the mobile client can distinguish expiry (retry
      // after refresh) from generic invalid-token (full logout).
      throw new HttpError(401, 'token_expired', 'TOKEN_EXPIRED');
    }
    throw new HttpError(401, 'unauthorized', 'invalid_token');
  }
};

// Token issuance lives in `src/services/tokenService.ts` because refresh
// tokens now require a DB row (server-side allowlist for revocation).
