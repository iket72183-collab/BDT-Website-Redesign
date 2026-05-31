import { z } from 'zod';

/** UUID URL param: `/:id` -> `{ id }` strongly-typed. */
export const uuidParamSchema = z.object({
  id: z.string().uuid(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const dateRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

/** Hex color like #C9A882 — matches the design-system constraint. */
export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'must be a 6-digit hex color like #C9A882');

/** Strong password rule — 12+ chars, mixed case + digit. */
export const passwordSchema = z
  .string()
  .min(12, 'password must be at least 12 characters')
  .regex(/[a-z]/, 'must include a lowercase letter')
  .regex(/[A-Z]/, 'must include an uppercase letter')
  .regex(/\d/, 'must include a digit');

export const phoneSchema = z.string().regex(/^\+?[0-9 .()-]{7,20}$/, 'invalid phone');

export type Pagination = z.infer<typeof paginationSchema>;
export type DateRange = z.infer<typeof dateRangeSchema>;
