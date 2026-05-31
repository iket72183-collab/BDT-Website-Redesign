import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { ok, paginated, created } from '../lib/response.js';
import { uuidParamSchema } from '../validators/shared.js';
import {
  listMessagesQuerySchema,
  messageSchema,
} from '../validators/message.validators.js';
import * as messageService from '../services/messageService.js';
import { getTenantId } from '../lib/tenantContext.js';
import { messageLimiter } from '../middleware/rateLimiter.js';

/**
 * Client-only routes. Mounted under /api/messages behind verifyToken +
 * tenantScope, so the client can only ever read/write their own tenant's
 * messages (the Prisma extension auto-injects tenantId).
 */
export const messagesRouter = Router();
messagesRouter.use(requireRole('client'));

messagesRouter.post(
  '/',
  messageLimiter,
  validate({ body: messageSchema }),
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const message = await messageService.sendMessage({
      tenantId,
      userId: req.auth!.sub,
      subject: req.body.subject,
      body: req.body.body,
    });
    created(res, { message, sent: true });
  }),
);

messagesRouter.get(
  '/',
  validate({ query: listMessagesQuerySchema }),
  asyncHandler(async (req, res) => {
    const { page, limit, status } = req.query as never;
    const { rows, total } = await messageService.listMessages({ page, limit, status });
    paginated(res, rows, { page, limit, total });
  }),
);

messagesRouter.patch(
  '/:id/read',
  validate({ params: uuidParamSchema }),
  asyncHandler(async (req, res) => {
    ok(res, await messageService.markRead(req.params.id!));
  }),
);
