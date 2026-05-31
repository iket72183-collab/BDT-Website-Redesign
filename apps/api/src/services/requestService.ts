import { Prisma, type RequestStatus, type RequestType } from '@prisma/client';
import { db, rawPrisma } from '../lib/db.js';
import { getTenantId } from '../lib/tenantContext.js';
import { HttpError } from '../middleware/error.js';
import { logger } from '../lib/logger.js';
import { logEvent } from './platformEventService.js';
import { PLANS } from '../lib/plans.js';
import { notifyBDTOfRequest } from './requestNotificationService.js';
import type { Attachment } from '../validators/request.validators.js';

/**
 * Client service requests. Reads/writes go through the tenant-scoped `db`
 * client, so every query is automatically constrained to the caller's tenant
 * (ServiceRequest is registered in TENANT_SCOPED). Monthly volume is capped
 * per plan via `requestsPerMonth` in plans.ts.
 */

/** First instant of the current calendar month, UTC. */
function startOfCurrentMonthUTC(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** First instant of next calendar month, UTC — when the monthly quota resets. */
function startOfNextMonthUTC(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

/** Count of this tenant's requests created in the current calendar month. */
async function usedThisMonth(): Promise<number> {
  return db.serviceRequest.count({
    where: { createdAt: { gte: startOfCurrentMonthUTC() } },
  });
}

interface CreateRequestInput {
  tenantId: string;
  type: RequestType;
  title: string;
  description: string;
  attachments?: Attachment[] | undefined;
}

export async function createRequest(input: CreateRequestInput) {
  const tenant = await rawPrisma.tenant.findUnique({
    where: { id: input.tenantId },
    select: { id: true, businessName: true, subscriptionTier: true },
  });
  if (!tenant) throw new HttpError(404, 'tenant_not_found', 'tenant_not_found');

  const limit = PLANS[tenant.subscriptionTier].requestsPerMonth;
  const used = await usedThisMonth();
  if (used >= limit) {
    throw new HttpError(429, 'Monthly request limit reached', 'REQUEST_LIMIT_REACHED', {
      limit,
      used,
    });
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

export interface RequestUsageResult {
  used: number;
  limit: number;
  resetsAt: string;
}

export async function getUsage(): Promise<RequestUsageResult> {
  const tenantId = getTenantId();
  const tenant = await rawPrisma.tenant.findUnique({
    where: { id: tenantId },
    select: { subscriptionTier: true },
  });
  if (!tenant) throw new HttpError(404, 'tenant_not_found', 'tenant_not_found');

  const limit = PLANS[tenant.subscriptionTier].requestsPerMonth;
  const used = await usedThisMonth();
  return { used, limit, resetsAt: startOfNextMonthUTC().toISOString() };
}
