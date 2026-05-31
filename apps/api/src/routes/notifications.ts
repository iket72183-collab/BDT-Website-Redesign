import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { noContent, ok, paginated } from '../lib/response.js';
import { uuidParamSchema } from '../validators/shared.js';
import {
  listNotificationsQuerySchema,
  updatePreferencesSchema,
} from '../validators/notification.validators.js';
import * as notificationService from '../services/notificationService.js';

// Any authenticated user — scoped to their own notifications.
export const notificationsRouter = Router();

// REALTIME-CANDIDATE — push notifications could stream over WebSocket /
// Server-Sent Events to update the badge live without polling this endpoint.
notificationsRouter.get(
  '/',
  validate({ query: listNotificationsQuerySchema }),
  asyncHandler(async (req, res) => {
    const { page, limit, unreadOnly } = req.query as never;
    const { rows, total } = await notificationService.listForUser(req.auth!.sub, {
      page, limit, unreadOnly,
    });
    paginated(res, rows, { page, limit, total });
  }),
);

notificationsRouter.patch(
  '/:id/read',
  validate({ params: uuidParamSchema }),
  asyncHandler(async (req, res) => {
    ok(res, await notificationService.markRead(req.params.id!, req.auth!.sub));
  }),
);

notificationsRouter.patch(
  '/read-all',
  asyncHandler(async (req, res) => {
    await notificationService.markAllRead(req.auth!.sub);
    noContent(res);
  }),
);

notificationsRouter.get(
  '/preferences',
  asyncHandler(async (req, res) => {
    ok(res, await notificationService.getPreferences(req.auth!.sub));
  }),
);

notificationsRouter.patch(
  '/preferences',
  validate({ body: updatePreferencesSchema }),
  asyncHandler(async (req, res) => {
    ok(res, await notificationService.updatePreferences(req.auth!.sub, req.body));
  }),
);
