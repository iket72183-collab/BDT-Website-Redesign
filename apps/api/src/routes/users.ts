import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { ok, paginated, noContent } from '../lib/response.js';
import { uuidParamSchema } from '../validators/shared.js';
import { listUsersQuerySchema, updateUserSchema } from '../validators/user.validators.js';
import * as userService from '../services/userService.js';

/**
 * In the agency-portal model every tenant has exactly one client user (the
 * business owner who signed up). These routes are kept for self-service:
 * a client can view + update their own row. There's no multi-user-per-tenant
 * concept any more.
 */
export const usersRouter = Router();
usersRouter.use(requireRole('client'));

usersRouter.get(
  '/',
  validate({ query: listUsersQuerySchema }),
  asyncHandler(async (req, res) => {
    const { page, limit, search, role, isActive } = req.query as never;
    const { rows, total } = await userService.listUsers({ page, limit, search, role, isActive });
    paginated(res, rows, { page, limit, total });
  }),
);

usersRouter.get(
  '/:id',
  validate({ params: uuidParamSchema }),
  asyncHandler(async (req, res) => {
    ok(res, await userService.getUser(req.params.id!));
  }),
);

usersRouter.patch(
  '/:id',
  validate({ params: uuidParamSchema, body: updateUserSchema }),
  asyncHandler(async (req, res) => {
    ok(res, await userService.updateUser(req.params.id!, req.body));
  }),
);

usersRouter.delete(
  '/:id',
  validate({ params: uuidParamSchema }),
  asyncHandler(async (req, res) => {
    await userService.softDeleteUser(req.params.id!);
    noContent(res);
  }),
);
