import { z } from 'zod';
import { paginationSchema, phoneSchema } from './shared.js';

export const listUsersQuerySchema = paginationSchema.extend({
  search: z.string().trim().min(1).max(80).optional(),
  role: z.enum(['client']).optional(),
  isActive: z.coerce.boolean().optional(),
});

export const updateUserSchema = z.object({
  firstName: z.string().min(1).max(80).optional(),
  lastName: z.string().min(1).max(80).optional(),
  phone: phoneSchema.optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
  isActive: z.boolean().optional(),
});
