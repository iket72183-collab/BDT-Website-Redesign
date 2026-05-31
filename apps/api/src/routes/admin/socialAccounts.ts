import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { ok, paginated } from '../../lib/response.js';
import { uuidParamSchema } from '../../validators/shared.js';
import {
  adminListSocialAccountsQuerySchema,
  updateSocialAccountStatusSchema,
} from '../../validators/socialAccount.validators.js';
import * as adminSocialAccountService from '../../services/adminSocialAccountService.js';

/**
 * Platform-admin social-account surface. Mounted at /api/admin/social-accounts
 * behind verifyToken + tenantScope (runAsPlatform). The reveal route is the
 * only place plaintext credentials leave the server, and it audit-logs.
 */
export const adminSocialAccountsRouter = Router();
adminSocialAccountsRouter.use(requireRole('platform_admin'));

adminSocialAccountsRouter.get(
  '/',
  validate({ query: adminListSocialAccountsQuerySchema }),
  asyncHandler(async (req, res) => {
    const { page, limit, tenantId, platform, status } = req.query as never;
    const { rows, total } = await adminSocialAccountService.adminListSocialAccounts({
      page,
      limit,
      tenantId,
      platform,
      status,
    });
    paginated(res, rows, { page, limit, total });
  }),
);

// SENSITIVE — decrypt + return the stored login. Audited inside the service.
adminSocialAccountsRouter.get(
  '/:id/credentials',
  validate({ params: uuidParamSchema }),
  asyncHandler(async (req, res) => {
    ok(res, await adminSocialAccountService.revealCredentials(req.params.id!, req.auth!.sub));
  }),
);

adminSocialAccountsRouter.patch(
  '/:id/status',
  validate({ params: uuidParamSchema, body: updateSocialAccountStatusSchema }),
  asyncHandler(async (req, res) => {
    ok(
      res,
      await adminSocialAccountService.adminUpdateSocialAccountStatus(
        req.params.id!,
        req.body.status,
      ),
    );
  }),
);
