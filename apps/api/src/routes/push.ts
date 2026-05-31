import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { ok } from '../lib/response.js';
import { HttpError } from '../middleware/error.js';
import { registerTokenSchema, deregisterTokenSchema } from '../validators/push.validators.js';
import * as pushService from '../services/pushService.js';

/**
 * Device push-token registration. Mounted under the authed `/api` block, so
 * `req.auth` is always populated. Every handler keys on `req.auth.sub` — a
 * user can only ever register/deregister/list their OWN devices.
 */
export const pushRouter = Router();

const ALL_APP_ROLES = ['client', 'platform_admin'] as const;

pushRouter.post(
  '/register',
  requireRole(...ALL_APP_ROLES),
  validate({ body: registerTokenSchema }),
  asyncHandler(async (req, res) => {
    if (!pushService.isValidExpoToken(req.body.token)) {
      throw new HttpError(400, 'invalid_push_token', 'invalid_push_token');
    }
    await pushService.registerToken(
      req.auth!.sub,
      req.auth!.tenantId ?? null,
      req.body.token,
      req.body.platform,
      req.body.deviceName,
    );
    ok(res, { registered: true });
  }),
);

pushRouter.delete(
  '/deregister',
  requireRole(...ALL_APP_ROLES),
  validate({ body: deregisterTokenSchema }),
  asyncHandler(async (req, res) => {
    await pushService.deregisterToken(req.auth!.sub, req.body.token);
    ok(res, { deregistered: true });
  }),
);

// Device management — lists the current user's active tokens.
pushRouter.get(
  '/tokens',
  requireRole(...ALL_APP_ROLES),
  asyncHandler(async (req, res) => {
    ok(res, await pushService.getUserTokens(req.auth!.sub));
  }),
);
