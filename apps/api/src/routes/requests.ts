import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { ok, created } from '../lib/response.js';
import { uuidParamSchema } from '../validators/shared.js';
import {
  createRequestSchema,
  listRequestsQuerySchema,
} from '../validators/request.validators.js';
import * as requestService from '../services/requestService.js';
import { getTenantId } from '../lib/tenantContext.js';

/**
 * Client-only request routes. Mounted under /api/requests behind verifyToken +
 * tenantScope + requireSubscription, so a client only ever touches their own
 * tenant's requests (the Prisma extension auto-injects tenantId).
 */
export const requestsRouter = Router();
requestsRouter.use(requireRole('client'));

requestsRouter.post(
  '/',
  validate({ body: createRequestSchema }),
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const request = await requestService.createRequest({
      tenantId,
      type: req.body.type,
      title: req.body.title,
      description: req.body.description,
      attachments: req.body.attachments,
      addOn: req.body.addOn,
    });
    created(res, request);
  }),
);

requestsRouter.get(
  '/',
  validate({ query: listRequestsQuerySchema }),
  asyncHandler(async (req, res) => {
    const { page, limit, status } = req.query as never;
    const { rows, total } = await requestService.listRequests({ page, limit, status });
    ok(res, { requests: rows, total, page, hasMore: page * limit < total });
  }),
);

// `/usage` MUST be declared before `/:id` or the literal would be captured as
// an id param and 400 on the uuid validator.
requestsRouter.get(
  '/usage',
  asyncHandler(async (_req, res) => {
    ok(res, await requestService.getUsage());
  }),
);

requestsRouter.get(
  '/:id',
  validate({ params: uuidParamSchema }),
  asyncHandler(async (req, res) => {
    ok(res, await requestService.getRequest(req.params.id!));
  }),
);
