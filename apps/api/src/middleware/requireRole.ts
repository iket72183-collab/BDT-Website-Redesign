import type { RequestHandler } from 'express';
import type { UserRole } from '@prisma/client';
import { HttpError } from './error.js';

/**
 * Role-based access gate. Pass one or more allowed roles — any match passes.
 * MUST run after `verifyToken` so `req.auth` is populated.
 *
 * Common idioms:
 *   requireRole('client')         → agency-portal clients only
 *   requireRole('platform_admin') → BDT team only
 */
export const requireRole =
  (...allowed: UserRole[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth) throw new HttpError(401, 'unauthorized', 'missing_token');
    if (!allowed.includes(req.auth.role)) {
      throw new HttpError(403, 'forbidden', 'role_not_permitted');
    }
    next();
  };
