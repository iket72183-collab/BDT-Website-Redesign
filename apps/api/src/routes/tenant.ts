import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { ok } from '../lib/response.js';
import {
  updateTenantSchema,
  updateTenantProfileSchema,
} from '../validators/tenant.validators.js';
import * as tenantService from '../services/tenantService.js';

// All routes mounted under /api/tenant. Client-only.
export const tenantRouter = Router();
tenantRouter.use(requireRole('client'));

tenantRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    ok(res, await tenantService.getCurrentTenant());
  }),
);

tenantRouter.patch(
  '/',
  validate({ body: updateTenantSchema }),
  asyncHandler(async (req, res) => {
    ok(res, await tenantService.updateTenant(req.body));
  }),
);

tenantRouter.patch(
  '/profile',
  validate({ body: updateTenantProfileSchema }),
  asyncHandler(async (req, res) => {
    ok(res, await tenantService.updateTenantProfile(req.body));
  }),
);

tenantRouter.get(
  '/subscription',
  asyncHandler(async (_req, res) => {
    ok(res, await tenantService.getSubscription());
  }),
);
