import { z } from 'zod';
import { RequestType, RequestStatus } from '@prisma/client';
import { paginationSchema } from './shared.js';

/**
 * One attachment descriptor. Files live in the private Supabase Storage bucket;
 * the client uploads via POST /api/uploads/request-attachment and sends back the
 * returned object `path`. The bucket has no public read access, so we persist
 * the path (not a URL) and resolve it to a short-lived signed URL on read.
 * Capped at 10MB/file to mirror the mobile UI.
 *
 * `path` is a storage key (e.g. `requests/{tenantId}/...`), not a URL — the
 * persisted column + the `ClientRequest` shared type both carry
 * `{ name, size, path }`, so the API contract, the DB row, and the mobile type
 * all agree.
 */
export const attachmentSchema = z.object({
  name: z.string().trim().min(1).max(255),
  size: z.number().int().nonnegative().max(10 * 1024 * 1024),
  path: z.string().trim().min(1).max(1024),
});

export const createRequestSchema = z.object({
  type: z.nativeEnum(RequestType),
  title: z.string().trim().min(1, 'Title is required').max(100),
  description: z.string().trim().min(1, 'Description is required').max(1000),
  attachments: z.array(attachmentSchema).max(5, 'Up to 5 files per request').optional(),
  // Set true to submit an over-limit request as a paid $25 add-on. Bypasses
  // the monthly per-type cap; BDT invoices for it separately.
  addOn: z.boolean().optional(),
});

export const listRequestsQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(RequestStatus).optional(),
});

// --- Admin-facing (platform_admin) -----------------------------------------

export const adminListRequestsQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(RequestStatus).optional(),
  type: z.nativeEnum(RequestType).optional(),
  search: z.string().trim().min(1).max(100).optional(),
});

export const updateRequestStatusSchema = z.object({
  status: z.nativeEnum(RequestStatus),
});

export type CreateRequestBody = z.infer<typeof createRequestSchema>;
export type Attachment = z.infer<typeof attachmentSchema>;
