import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { ok, paginated } from '../lib/response.js';
import { uuidParamSchema, paginationSchema } from '../validators/shared.js';
import {
  listClientsQuerySchema,
  listMessagesQuerySchema,
  listSubscriptionEventsQuerySchema,
  platformEventsQuerySchema,
  updateClientSchema,
} from '../validators/admin.validators.js';
import * as adminService from '../services/adminService.js';
import { getQueueHealth } from '../queues/monitor.js';

/**
 * Platform-admin surface. The tenantScope middleware has dispatched the
 * caller through runAsPlatform(), so the Prisma extension is a no-op —
 * services use rawPrisma to read across tenants.
 */
export const adminRouter = Router();
adminRouter.use(requireRole('platform_admin'));

// ============================================================================
// Clients (preferred admin vocabulary; same row as `tenants`)
// ============================================================================

adminRouter.get(
  '/clients',
  validate({ query: listClientsQuerySchema }),
  asyncHandler(async (req, res) => {
    const { page, limit, search, plan, status, sort, order } = req.query as never;
    const { rows, total } = await adminService.listClients({
      page, limit, search, plan, status, sort, order,
    });
    paginated(res, rows, { page, limit, total });
  }),
);

adminRouter.get(
  '/clients/:id',
  validate({ params: uuidParamSchema }),
  asyncHandler(async (req, res) => {
    ok(res, await adminService.getClient(req.params.id!));
  }),
);

adminRouter.patch(
  '/clients/:id',
  validate({ params: uuidParamSchema, body: updateClientSchema }),
  asyncHandler(async (req, res) => {
    ok(res, await adminService.updateClient(req.params.id!, req.body));
  }),
);

// ============================================================================
// Legacy /tenants — kept as thin aliases so any older callers keep working.
// ============================================================================

adminRouter.get(
  '/tenants',
  validate({ query: listClientsQuerySchema }),
  asyncHandler(async (req, res) => {
    const { page, limit, search, plan, status, sort, order } = req.query as never;
    const { rows, total } = await adminService.listClients({
      page, limit, search, plan, status, sort, order,
    });
    paginated(res, rows, { page, limit, total });
  }),
);

adminRouter.get(
  '/tenants/:id',
  validate({ params: uuidParamSchema }),
  asyncHandler(async (req, res) => {
    ok(res, await adminService.getTenant(req.params.id!));
  }),
);

adminRouter.patch(
  '/tenants/:id',
  validate({ params: uuidParamSchema, body: updateClientSchema }),
  asyncHandler(async (req, res) => {
    ok(res, await adminService.updateTenant(req.params.id!, req.body));
  }),
);

// ============================================================================
// Messages — cross-tenant inbox
// ============================================================================

adminRouter.get(
  '/messages',
  validate({ query: listMessagesQuerySchema }),
  asyncHandler(async (req, res) => {
    const { page, limit, status, tenantId } = req.query as never;
    const result = await adminService.listAllMessages({ page, limit, status, tenantId });
    // Surface the platform-wide unread count next to the page rows so the
    // sidebar can render its badge without an extra request.
    ok(
      res,
      { rows: result.rows, unreadCount: result.unreadCount },
      { page, limit, total: result.total },
    );
  }),
);

adminRouter.patch(
  '/messages/:id/read',
  validate({ params: uuidParamSchema }),
  asyncHandler(async (req, res) => {
    ok(res, await adminService.markMessageRead(req.params.id!));
  }),
);

// ============================================================================
// Revenue
// ============================================================================

adminRouter.get(
  '/revenue',
  asyncHandler(async (_req, res) => {
    ok(res, await adminService.revenueOverview());
  }),
);

// ============================================================================
// Stats / users / events
// ============================================================================

adminRouter.get(
  '/users',
  validate({ query: paginationSchema }),
  asyncHandler(async (req, res) => {
    const { page, limit } = req.query as never;
    const { rows, total } = await adminService.listAllUsers({ page, limit });
    paginated(res, rows, { page, limit, total });
  }),
);

adminRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    ok(res, await adminService.platformStats());
  }),
);

adminRouter.get(
  '/events',
  validate({ query: platformEventsQuerySchema }),
  asyncHandler(async (req, res) => {
    const { page, limit, eventType, tenantId, from, to } = req.query as never;
    const { rows, total } = await adminService.listPlatformEvents({
      page, limit, eventType, tenantId, from, to,
    });
    paginated(res, rows, { page, limit, total });
  }),
);

adminRouter.get(
  '/subscription-events',
  validate({ query: listSubscriptionEventsQuerySchema }),
  asyncHandler(async (req, res) => {
    const { page, limit, eventType, tenantId } = req.query as never;
    const { rows, total } = await adminService.listSubscriptionEvents({
      page, limit, eventType, tenantId,
    });
    paginated(res, rows, { page, limit, total });
  }),
);

adminRouter.get(
  '/queue-health',
  asyncHandler(async (_req, res) => {
    const { platformEvents, reachable } = await getQueueHealth();
    ok(res, { queues: { platformEvents }, reachable });
  }),
);
