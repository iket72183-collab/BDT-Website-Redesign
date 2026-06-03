import { Prisma, type RequestStatus, type RequestType } from '@prisma/client';
import { db, rawPrisma } from '../lib/db.js';
import { getTenantId } from '../lib/tenantContext.js';
import { HttpError } from '../middleware/error.js';
import { logger } from '../lib/logger.js';
import { logEvent } from './platformEventService.js';
import {
  PLAN_LIMITS,
  LIMITED_REQUEST_TYPES,
  monthlyLimitFor,
  type LimitedRequestType,
} from '../lib/plans.js';
import { notifyBDTOfRequest } from './requestNotificationService.js';
import type { Attachment } from '../validators/request.validators.js';

/**
 * Client service requests. Reads/writes go through the tenant-scoped `db`
 * client, so every query is automatically constrained to the caller's tenant
 * (ServiceRequest is registered in TENANT_SCOPED). Each limited request type
 * has its own monthly cap (see PLAN_LIMITS in plans.ts); over-limit requests
 * are accepted as paid $25 add-ons.
 */

/** First instant of the current calendar month, UTC. */
function startOfCurrentMonthUTC(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Count of this tenant's requests of a given type in the current calendar
 *  month. The per-type cap resets when the calendar month rolls over. */
async function usedThisMonthByType(type: RequestType): Promise<number> {
  return db.serviceRequest.count({
    where: { type, createdAt: { gte: startOfCurrentMonthUTC() } },
  });
}

interface CreateRequestInput {
  tenantId: string;
  type: RequestType;
  title: string;
  description: string;
  attachments?: Attachment[] | undefined;
  /** Submit as a paid over-limit add-on — bypasses the monthly per-type cap. */
  addOn?: boolean | undefined;
}

export async function createRequest(input: CreateRequestInput) {
  const tenant = await rawPrisma.tenant.findUnique({
    where: { id: input.tenantId },
    select: { id: true, businessName: true, subscriptionTier: true },
  });
  if (!tenant) throw new HttpError(404, 'tenant_not_found', 'tenant_not_found');

  // Per-type monthly cap. Uncapped types (general / file_upload) return null.
  // Add-on requests bypass the cap — BDT invoices for them separately.
  const limit = monthlyLimitFor(tenant.subscriptionTier, input.type);
  if (limit !== null && !input.addOn) {
    const used = await usedThisMonthByType(input.type);
    if (used >= limit) {
      throw new HttpError(
        429,
        "You've reached your monthly limit for this request type.",
        'monthly_limit_reached',
        {
          type: input.type,
          limit,
          used,
          addon_price: PLAN_LIMITS[tenant.subscriptionTier].addon_price_cents / 100,
        },
      );
    }
  }

  const request = await db.serviceRequest.create({
    data: {
      // Pass tenantId explicitly to satisfy the create type; the tenant-scope
      // extension also injects it at runtime (same value) — matches the
      // messageService pattern.
      tenantId: input.tenantId,
      type: input.type,
      title: input.title,
      description: input.description,
      attachments: (input.attachments ?? []) as unknown as Prisma.InputJsonValue,
      addOn: input.addOn ?? false,
    },
  });

  // Notify BDT (email + push). Best-effort: a notification failure must never
  // fail the request the client just submitted.
  await notifyBDTOfRequest(request, tenant).catch((err) =>
    logger.error({ err, requestId: request.id }, 'request.notify_failed'),
  );

  await logEvent('request.created', {
    requestId: request.id,
    tenantId: tenant.id,
    type: request.type,
    addOn: request.addOn,
  });

  return request;
}

interface ListRequestsInput {
  page: number;
  limit: number;
  status?: RequestStatus | undefined;
}

export async function listRequests(input: ListRequestsInput) {
  const where = input.status ? { status: input.status } : {};
  const [rows, total] = await db.$transaction([
    db.serviceRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
    db.serviceRequest.count({ where }),
  ]);
  return { rows, total };
}

/** Single request — findFirst (not findUnique) so tenant scoping applies and a
 *  cross-tenant id resolves to null → 404. */
export async function getRequest(id: string) {
  const request = await db.serviceRequest.findFirst({ where: { id } });
  if (!request) throw new HttpError(404, 'not_found', 'not_found');
  return request;
}

/** Current calendar-month usage vs. limit for each limited request type. */
export type RequestUsageResult = Record<LimitedRequestType, { used: number; limit: number }>;

export async function getUsage(): Promise<RequestUsageResult> {
  const tenantId = getTenantId();
  const tenant = await rawPrisma.tenant.findUnique({
    where: { id: tenantId },
    select: { subscriptionTier: true },
  });
  if (!tenant) throw new HttpError(404, 'tenant_not_found', 'tenant_not_found');

  const limits = PLAN_LIMITS[tenant.subscriptionTier];
  const entries = await Promise.all(
    LIMITED_REQUEST_TYPES.map(
      async (type) =>
        [type, { used: await usedThisMonthByType(type), limit: limits[type] }] as const,
    ),
  );
  return Object.fromEntries(entries) as RequestUsageResult;
}
