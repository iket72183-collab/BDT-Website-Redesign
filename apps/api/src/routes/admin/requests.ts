import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { ok, paginated } from '../../lib/response.js';
import { uuidParamSchema } from '../../validators/shared.js';
import {
  adminListRequestsQuerySchema,
  updateRequestStatusSchema,
} from '../../validators/request.validators.js';
import * as adminRequestService from '../../services/adminRequestService.js';

/**
 * Platform-admin request surface. Mounted at /api/admin/requests behind
 * verifyToken + tenantScope (runAsPlatform → Prisma extension is a no-op, so
 * the service reads across tenants via rawPrisma).
 */
export const adminRequestsRouter = Router();
adminRequestsRouter.use(requireRole('platform_admin'));

adminRequestsRouter.get(
  '/',
  validate({ query: adminListRequestsQuerySchema }),
  asyncHandler(async (req, res) => {
    const { page, limit, status, type, search } = req.query as never;
    const { rows, total } = await adminRequestService.adminListRequests({
      page,
      limit,
      status,
      type,
      search,
    });
    paginated(res, rows, { page, limit, total });
  }),
);

adminRequestsRouter.patch(
  '/:id/status',
  validate({ params: uuidParamSchema, body: updateRequestStatusSchema }),
  asyncHandler(async (req, res) => {
    ok(res, await adminRequestService.adminUpdateRequestStatus(req.params.id!, req.body.status));
  }),
);
