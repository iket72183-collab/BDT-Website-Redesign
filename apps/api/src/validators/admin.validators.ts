import { z } from 'zod';
import { SubscriptionTier, SubscriptionStatus, MessageStatus } from '@prisma/client';
import { dateRangeSchema, paginationSchema } from './shared.js';

export const listClientsQuerySchema = paginationSchema.extend({
  search: z.string().trim().min(1).max(80).optional(),
  plan:   z.nativeEnum(SubscriptionTier).optional(),
  status: z.nativeEnum(SubscriptionStatus).optional(),
  sort:   z.enum(['joined', 'mrr', 'name']).optional(),
  order:  z.enum(['asc', 'desc']).optional(),
});

/** Legacy alias kept for the existing /tenants routes — same shape. */
export const listTenantsQuerySchema = listClientsQuerySchema;

export const updateClientSchema = z.object({
  notes:              z.string().max(5000).nullable().optional(),
  isActive:           z.boolean().optional(),
  subscriptionTier:   z.nativeEnum(SubscriptionTier).optional(),
  subscriptionStatus: z.nativeEnum(SubscriptionStatus).optional(),
});

/** Legacy alias for /tenants — same shape. */
export const updateTenantSchema = updateClientSchema;

export const listMessagesQuerySchema = paginationSchema.extend({
  status:   z.nativeEnum(MessageStatus).optional(),
  tenantId: z.string().uuid().optional(),
});

export const listSubscriptionEventsQuerySchema = paginationSchema.extend({
  eventType: z.string().max(60).optional(),
  tenantId:  z.string().uuid().optional(),
});

export const platformEventsQuerySchema = paginationSchema.merge(dateRangeSchema).extend({
  eventType: z.string().max(120).optional(),
  tenantId:  z.string().uuid().optional(),
});
