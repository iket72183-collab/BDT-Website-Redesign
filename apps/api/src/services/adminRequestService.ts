import { Prisma, type RequestStatus, type RequestType } from '@prisma/client';
import { rawPrisma } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { logEvent } from './platformEventService.js';
import { notifyClientStatusUpdate } from './requestNotificationService.js';

/**
 * Platform-admin request operations. Runs in the runAsPlatform() context, so
 * these use rawPrisma to read/write across all tenants. Each row is joined to
 * its tenant to surface the business name + plan in the admin table.
 */

interface AdminListInput {
  page: number;
  limit: number;
  status?: RequestStatus | undefined;
  type?: RequestType | undefined;
  search?: string | undefined;
}

export async function adminListRequests(input: AdminListInput) {
  const where: Prisma.ServiceRequestWhereInput = {};
  if (input.status) where.status = input.status;
  if (input.type) where.type = input.type;
  if (input.search) {
    where.tenant = { businessName: { contains: input.search, mode: 'insensitive' } };
  }

  const [rows, total] = await rawPrisma.$transaction([
    rawPrisma.serviceRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
      include: {
        tenant: { select: { id: true, businessName: true, subscriptionTier: true } },
      },
    }),
    rawPrisma.serviceRequest.count({ where }),
  ]);
  return { rows, total };
}

export async function adminUpdateRequestStatus(id: string, status: RequestStatus) {
  // Unknown id → Prisma P2025 → mapped to 404 by the global error handler.
  const updated = await rawPrisma.serviceRequest.update({
    where: { id },
    data: { status },
  });
  await logEvent('request.status_updated', { requestId: id, status });

  // Fire-and-forget: notify the client on meaningful transitions. Not awaited
  // so the HTTP response returns immediately; the push sends in the background.
  // notifyClientStatusUpdate already swallows its own errors — the .catch here
  // guards against an unexpected synchronous/rejection path.
  void notifyClientStatusUpdate(updated, status).catch((err) =>
    logger.error({ err, requestId: id }, 'request.client_status_push_failed'),
  );

  return updated;
}
