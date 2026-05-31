import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { ok, created, noContent } from '../lib/response.js';
import { uuidParamSchema } from '../validators/shared.js';
import {
  createSocialAccountSchema,
  updateSocialAccountSchema,
  setCredentialsSchema,
} from '../validators/socialAccount.validators.js';
import * as socialAccountService from '../services/socialAccountService.js';
import { getTenantId } from '../lib/tenantContext.js';

/**
 * Client-only social-account routes. Mounted under /api/social-accounts behind
 * verifyToken + tenantScope + requireSubscription. `secretCiphertext` is never
 * returned on this surface (the service uses a ciphertext-free projection).
 */
export const socialAccountsRouter = Router();
socialAccountsRouter.use(requireRole('client'));

socialAccountsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    ok(res, await socialAccountService.listSocialAccounts());
  }),
);

socialAccountsRouter.post(
  '/',
  validate({ body: createSocialAccountSchema }),
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const account = await socialAccountService.createSocialAccount({
      tenantId,
      platform: req.body.platform,
      handle: req.body.handle,
      accessMethod: req.body.accessMethod,
      notes: req.body.notes,
    });
    created(res, account);
  }),
);

socialAccountsRouter.patch(
  '/:id',
  validate({ params: uuidParamSchema, body: updateSocialAccountSchema }),
  asyncHandler(async (req, res) => {
    ok(res, await socialAccountService.updateSocialAccount(req.params.id!, req.body));
  }),
);

// Sensitive path: set/replace the stored login. Encrypts server-side; returns
// only confirmation + timestamp, never the ciphertext or plaintext.
socialAccountsRouter.patch(
  '/:id/credentials',
  validate({ params: uuidParamSchema, body: setCredentialsSchema }),
  asyncHandler(async (req, res) => {
    ok(
      res,
      await socialAccountService.setSocialAccountCredentials(
        req.params.id!,
        req.body.username,
        req.body.password,
      ),
    );
  }),
);

socialAccountsRouter.delete(
  '/:id',
  validate({ params: uuidParamSchema }),
  asyncHandler(async (req, res) => {
    await socialAccountService.removeSocialAccount(req.params.id!);
    noContent(res);
  }),
);
