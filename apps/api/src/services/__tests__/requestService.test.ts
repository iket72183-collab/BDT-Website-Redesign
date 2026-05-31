import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Client request service + admin request service tests.
 *
 * Coverage (per the feature spec):
 *   - createRequest success on Basic + Premium → persists, notifies BDT, logs.
 *   - createRequest 429 when the monthly limit is hit.
 *   - monthly window: count is scoped to the current calendar month (so the
 *     quota resets on a new month).
 *   - listRequests returns rows + total ordered newest-first, paginated.
 *   - getRequest 404 when the id resolves to nothing for this tenant.
 *   - getUsage returns used/limit/resetsAt with the right reset date.
 *   - adminUpdateRequestStatus updates + logs; adminListRequests builds the
 *     cross-tenant filter + join.
 *
 * The tenant-scope Prisma extension is exercised in integration, not here —
 * these unit tests mock the db client and assert the query args the services
 * build (the extension injects tenantId on top of them at runtime).
 */

const { dbMock, rawPrismaMock, notifyMock, clientNotifyMock, eventMock, loggerMock } = vi.hoisted(() => ({
  dbMock: {
    serviceRequest: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(async (ops: unknown[]) =>
      Array.isArray(ops) ? Promise.all(ops as Promise<unknown>[]) : (ops as unknown),
    ),
  },
  rawPrismaMock: {
    tenant: { findUnique: vi.fn() },
    serviceRequest: { findMany: vi.fn(), count: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) =>
      Array.isArray(ops) ? Promise.all(ops as Promise<unknown>[]) : (ops as unknown),
    ),
  },
  notifyMock: vi.fn().mockResolvedValue(undefined),
  clientNotifyMock: vi.fn().mockResolvedValue(undefined),
  eventMock: vi.fn().mockResolvedValue(undefined),
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../lib/db.js', () => ({ db: dbMock, rawPrisma: rawPrismaMock }));
vi.mock('../../lib/tenantContext.js', () => ({ getTenantId: () => 'tenant_test_id' }));
vi.mock('../../lib/logger.js', () => ({ logger: loggerMock }));
vi.mock('../requestNotificationService.js', () => ({
  notifyBDTOfRequest: notifyMock,
  notifyClientStatusUpdate: clientNotifyMock,
}));
vi.mock('../platformEventService.js', () => ({ logEvent: eventMock }));

import { createRequest, listRequests, getRequest, getUsage } from '../requestService.js';
import { adminListRequests, adminUpdateRequestStatus } from '../adminRequestService.js';

const TENANT_BASIC = {
  id: 'tenant_test_id',
  businessName: 'Acme Salon',
  subscriptionTier: 'basic' as const,
};
const TENANT_PREMIUM = { ...TENANT_BASIC, subscriptionTier: 'premium' as const };

const CREATED = new Date('2026-05-29T12:00:00Z');
function makeRequest(over: Record<string, unknown> = {}) {
  return {
    id: 'req_1',
    tenantId: TENANT_BASIC.id,
    type: 'general',
    title: 'Need a homepage tweak',
    description: 'Please update the hero text.',
    status: 'pending',
    attachments: [],
    createdAt: CREATED,
    updatedAt: CREATED,
    ...over,
  };
}

// Mirror the service's month math for assertions.
function startOfCurrentMonthUTC(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
function startOfNextMonthUTC(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

beforeEach(() => {
  dbMock.serviceRequest.create.mockReset();
  dbMock.serviceRequest.findMany.mockReset();
  dbMock.serviceRequest.findFirst.mockReset();
  dbMock.serviceRequest.count.mockReset();
  rawPrismaMock.tenant.findUnique.mockReset();
  rawPrismaMock.serviceRequest.findMany.mockReset();
  rawPrismaMock.serviceRequest.count.mockReset();
  rawPrismaMock.serviceRequest.update.mockReset();
  notifyMock.mockReset().mockResolvedValue(undefined);
  clientNotifyMock.mockReset().mockResolvedValue(undefined);
  eventMock.mockReset().mockResolvedValue(undefined);
  loggerMock.error.mockReset();

  rawPrismaMock.tenant.findUnique.mockResolvedValue(TENANT_BASIC);
  dbMock.serviceRequest.count.mockResolvedValue(0);
  dbMock.serviceRequest.create.mockResolvedValue(makeRequest());
});

describe('createRequest', () => {
  it('creates a request on the Basic plan, notifies BDT, and logs the event', async () => {
    const result = await createRequest({
      tenantId: TENANT_BASIC.id,
      type: 'general',
      title: 'Need a homepage tweak',
      description: 'Please update the hero text.',
    });

    expect(result.id).toBe('req_1');
    expect(dbMock.serviceRequest.create).toHaveBeenCalledWith({
      data: {
        tenantId: TENANT_BASIC.id,
        type: 'general',
        title: 'Need a homepage tweak',
        description: 'Please update the hero text.',
        attachments: [],
      },
    });
    expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'req_1' }), TENANT_BASIC);
    expect(eventMock).toHaveBeenCalledWith(
      'request.created',
      expect.objectContaining({ requestId: 'req_1', tenantId: TENANT_BASIC.id }),
    );
  });

  it('persists provided attachments', async () => {
    const attachments = [
      { name: 'logo.png', size: 2048, path: 'requests/tenant_basic/1700000000000-logo.png' },
    ];
    await createRequest({
      tenantId: TENANT_BASIC.id,
      type: 'file_upload',
      title: 'Logo',
      description: 'Use this logo',
      attachments,
    });
    expect(dbMock.serviceRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ attachments }),
    });
  });

  it('allows creation on Premium when under the higher limit (10 of 20)', async () => {
    rawPrismaMock.tenant.findUnique.mockResolvedValue(TENANT_PREMIUM);
    dbMock.serviceRequest.count.mockResolvedValue(10);
    const result = await createRequest({
      tenantId: TENANT_PREMIUM.id,
      type: 'social_media',
      title: 'New post',
      description: 'Promote the sale',
    });
    expect(result.id).toBe('req_1');
    expect(dbMock.serviceRequest.create).toHaveBeenCalled();
  });

  it('throws 429 REQUEST_LIMIT_REACHED when the Basic monthly limit (5) is hit', async () => {
    dbMock.serviceRequest.count.mockResolvedValue(5);
    await expect(
      createRequest({
        tenantId: TENANT_BASIC.id,
        type: 'general',
        title: 'One too many',
        description: 'nope',
      }),
    ).rejects.toMatchObject({
      status: 429,
      code: 'REQUEST_LIMIT_REACHED',
      details: { limit: 5, used: 5 },
    });
    expect(dbMock.serviceRequest.create).not.toHaveBeenCalled();
  });

  it('throws 429 on Premium only at 20', async () => {
    rawPrismaMock.tenant.findUnique.mockResolvedValue(TENANT_PREMIUM);
    dbMock.serviceRequest.count.mockResolvedValue(20);
    await expect(
      createRequest({ tenantId: TENANT_PREMIUM.id, type: 'general', title: 'x', description: 'y' }),
    ).rejects.toMatchObject({ status: 429, details: { limit: 20, used: 20 } });
  });

  it('counts only requests from the current calendar month (quota resets monthly)', async () => {
    await createRequest({ tenantId: TENANT_BASIC.id, type: 'general', title: 'x', description: 'y' });
    const countArg = dbMock.serviceRequest.count.mock.calls[0]![0];
    expect(countArg.where.createdAt.gte.getTime()).toBe(startOfCurrentMonthUTC().getTime());
  });

  it('still succeeds when BDT notification fails (best-effort)', async () => {
    notifyMock.mockRejectedValueOnce(new Error('resend down'));
    const result = await createRequest({
      tenantId: TENANT_BASIC.id,
      type: 'general',
      title: 'x',
      description: 'y',
    });
    expect(result.id).toBe('req_1');
    expect(loggerMock.error).toHaveBeenCalled();
  });

  it('404s when the tenant is missing', async () => {
    rawPrismaMock.tenant.findUnique.mockResolvedValueOnce(null);
    await expect(
      createRequest({ tenantId: 'nope', type: 'general', title: 'x', description: 'y' }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('listRequests', () => {
  it('returns rows + total ordered newest-first, paginated', async () => {
    const rows = [makeRequest({ id: 'req_2' }), makeRequest({ id: 'req_1' })];
    dbMock.serviceRequest.findMany.mockResolvedValue(rows);
    dbMock.serviceRequest.count.mockResolvedValue(2);

    const result = await listRequests({ page: 1, limit: 20 });

    expect(dbMock.serviceRequest.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 20,
    });
    expect(result).toEqual({ rows, total: 2 });
  });

  it('filters by status and paginates', async () => {
    dbMock.serviceRequest.findMany.mockResolvedValue([]);
    dbMock.serviceRequest.count.mockResolvedValue(0);
    await listRequests({ page: 2, limit: 10, status: 'completed' });
    expect(dbMock.serviceRequest.findMany).toHaveBeenCalledWith({
      where: { status: 'completed' },
      orderBy: { createdAt: 'desc' },
      skip: 10,
      take: 10,
    });
  });
});

describe('getRequest', () => {
  it('returns the request (findFirst → tenant-scoped by the extension)', async () => {
    const row = makeRequest();
    dbMock.serviceRequest.findFirst.mockResolvedValue(row);
    const result = await getRequest('req_1');
    expect(result).toBe(row);
    expect(dbMock.serviceRequest.findFirst).toHaveBeenCalledWith({ where: { id: 'req_1' } });
  });

  it('404s when no row matches (unknown id or wrong tenant)', async () => {
    dbMock.serviceRequest.findFirst.mockResolvedValue(null);
    await expect(getRequest('req_missing')).rejects.toMatchObject({ status: 404 });
  });
});

describe('getUsage', () => {
  it('returns used / limit / resetsAt for the caller plan', async () => {
    dbMock.serviceRequest.count.mockResolvedValue(3);
    const usage = await getUsage();
    expect(usage).toEqual({
      used: 3,
      limit: 5,
      resetsAt: startOfNextMonthUTC().toISOString(),
    });
  });

  it('reflects the Premium limit', async () => {
    rawPrismaMock.tenant.findUnique.mockResolvedValue(TENANT_PREMIUM);
    dbMock.serviceRequest.count.mockResolvedValue(0);
    const usage = await getUsage();
    expect(usage.limit).toBe(20);
  });
});

describe('adminUpdateRequestStatus', () => {
  it('updates the status and logs the event', async () => {
    rawPrismaMock.serviceRequest.update.mockResolvedValue(makeRequest({ status: 'in_progress' }));
    const result = await adminUpdateRequestStatus('req_1', 'in_progress');
    expect(result.status).toBe('in_progress');
    expect(rawPrismaMock.serviceRequest.update).toHaveBeenCalledWith({
      where: { id: 'req_1' },
      data: { status: 'in_progress' },
    });
    expect(eventMock).toHaveBeenCalledWith(
      'request.status_updated',
      expect.objectContaining({ requestId: 'req_1', status: 'in_progress' }),
    );
  });

  it('fires the client status push (fire-and-forget) with the updated row + status', async () => {
    rawPrismaMock.serviceRequest.update.mockResolvedValue(makeRequest({ status: 'completed' }));
    await adminUpdateRequestStatus('req_1', 'completed');
    expect(clientNotifyMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'req_1' }),
      'completed',
    );
  });
});

describe('adminListRequests', () => {
  it('builds the cross-tenant filter (status/type/search) and joins the tenant', async () => {
    rawPrismaMock.serviceRequest.findMany.mockResolvedValue([makeRequest()]);
    rawPrismaMock.serviceRequest.count.mockResolvedValue(1);

    const result = await adminListRequests({
      page: 1,
      limit: 20,
      status: 'pending',
      type: 'website_update',
      search: 'Acme',
    });

    expect(result.total).toBe(1);
    expect(rawPrismaMock.serviceRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'pending',
          type: 'website_update',
          tenant: { businessName: { contains: 'Acme', mode: 'insensitive' } },
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
        include: { tenant: { select: { id: true, businessName: true, subscriptionTier: true } } },
      }),
    );
  });
});
