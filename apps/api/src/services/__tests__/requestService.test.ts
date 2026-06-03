import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Client request service + admin request service tests.
 *
 * Coverage (per the feature spec):
 *   - createRequest success on the single Premium plan → persists, notifies BDT, logs.
 *   - createRequest 429 at a per-type monthly cap; addOn:true bypasses the cap.
 *   - uncapped types (general / file_upload) skip the count entirely.
 *   - monthly window: count is scoped to type + the current calendar month.
 *   - listRequests returns rows + total ordered newest-first, paginated.
 *   - getRequest 404 when the id resolves to nothing for this tenant.
 *   - getUsage returns per-type used/limit for the current month.
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

// Single-plan model: every tenant is on Premium; limits are per request type.
const TENANT = {
  id: 'tenant_test_id',
  businessName: 'Acme Salon',
  subscriptionTier: 'premium' as const,
};

const CREATED = new Date('2026-05-29T12:00:00Z');
function makeRequest(over: Record<string, unknown> = {}) {
  return {
    id: 'req_1',
    tenantId: TENANT.id,
    type: 'general',
    title: 'Need a homepage tweak',
    description: 'Please update the hero text.',
    status: 'pending',
    attachments: [],
    addOn: false,
    createdAt: CREATED,
    updatedAt: CREATED,
    ...over,
  };
}

// Mirror the service's month math for assertions.
function startOfCurrentMonthUTC(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
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

  rawPrismaMock.tenant.findUnique.mockResolvedValue(TENANT);
  dbMock.serviceRequest.count.mockResolvedValue(0);
  dbMock.serviceRequest.create.mockResolvedValue(makeRequest());
});

describe('createRequest', () => {
  it('creates a request on the Premium plan, notifies BDT, and logs the event', async () => {
    const result = await createRequest({
      tenantId: TENANT.id,
      type: 'general',
      title: 'Need a homepage tweak',
      description: 'Please update the hero text.',
    });

    expect(result.id).toBe('req_1');
    expect(dbMock.serviceRequest.create).toHaveBeenCalledWith({
      data: {
        tenantId: TENANT.id,
        type: 'general',
        title: 'Need a homepage tweak',
        description: 'Please update the hero text.',
        attachments: [],
        addOn: false,
      },
    });
    expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'req_1' }), TENANT);
    expect(eventMock).toHaveBeenCalledWith(
      'request.created',
      expect.objectContaining({ requestId: 'req_1', tenantId: TENANT.id }),
    );
  });

  it('persists provided attachments', async () => {
    const attachments = [
      { name: 'logo.png', size: 2048, path: 'requests/tenant_basic/1700000000000-logo.png' },
    ];
    await createRequest({
      tenantId: TENANT.id,
      type: 'file_upload',
      title: 'Logo',
      description: 'Use this logo',
      attachments,
    });
    expect(dbMock.serviceRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ attachments }),
    });
  });

  it('allows creation when under the per-type cap (social_media 5/12)', async () => {
    dbMock.serviceRequest.count.mockResolvedValue(5);
    const result = await createRequest({
      tenantId: TENANT.id,
      type: 'social_media',
      title: 'New post',
      description: 'Promote the sale',
    });
    expect(result.id).toBe('req_1');
    expect(dbMock.serviceRequest.create).toHaveBeenCalled();
  });

  it('allows uncapped types (general / file_upload) without counting', async () => {
    dbMock.serviceRequest.count.mockResolvedValue(999);
    await createRequest({ tenantId: TENANT.id, type: 'general', title: 'x', description: 'y' });
    expect(dbMock.serviceRequest.create).toHaveBeenCalled();
    // Uncapped types short-circuit before the per-type count.
    expect(dbMock.serviceRequest.count).not.toHaveBeenCalled();
  });

  it('throws 429 monthly_limit_reached at the per-type cap (ai_creative 4/4)', async () => {
    dbMock.serviceRequest.count.mockResolvedValue(4); // ai_creative cap is 4
    await expect(
      createRequest({
        tenantId: TENANT.id,
        type: 'ai_creative',
        title: 'One too many',
        description: 'nope',
      }),
    ).rejects.toMatchObject({
      status: 429,
      code: 'monthly_limit_reached',
      details: { type: 'ai_creative', limit: 4, used: 4, addon_price: 25 },
    });
    expect(dbMock.serviceRequest.create).not.toHaveBeenCalled();
  });

  it('accepts an over-limit request when addOn is set (bypasses the cap)', async () => {
    dbMock.serviceRequest.count.mockResolvedValue(4); // already at the ai_creative cap
    dbMock.serviceRequest.create.mockResolvedValue(makeRequest({ type: 'ai_creative', addOn: true }));
    const result = await createRequest({
      tenantId: TENANT.id,
      type: 'ai_creative',
      title: 'Extra flyer',
      description: 'summer promo',
      addOn: true,
    });
    expect(result.id).toBe('req_1');
    expect(dbMock.serviceRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'ai_creative', addOn: true }),
    });
    // addOn short-circuits the cap check, so we never count.
    expect(dbMock.serviceRequest.count).not.toHaveBeenCalled();
  });

  it('accepts the new ai_creative and report_request types', async () => {
    await createRequest({ tenantId: TENANT.id, type: 'ai_creative', title: 'Flyer', description: 'spring promo' });
    await createRequest({ tenantId: TENANT.id, type: 'report_request', title: 'Report', description: 'May numbers' });
    expect(dbMock.serviceRequest.create).toHaveBeenCalledTimes(2);
    expect(dbMock.serviceRequest.create.mock.calls[0]![0].data.type).toBe('ai_creative');
    expect(dbMock.serviceRequest.create.mock.calls[1]![0].data.type).toBe('report_request');
  });

  it('counts only the same type from the current calendar month (cap resets monthly)', async () => {
    await createRequest({ tenantId: TENANT.id, type: 'ai_creative', title: 'x', description: 'y' });
    const countArg = dbMock.serviceRequest.count.mock.calls[0]![0];
    expect(countArg.where.type).toBe('ai_creative');
    expect(countArg.where.createdAt.gte.getTime()).toBe(startOfCurrentMonthUTC().getTime());
  });

  it('still succeeds when BDT notification fails (best-effort)', async () => {
    notifyMock.mockRejectedValueOnce(new Error('resend down'));
    const result = await createRequest({
      tenantId: TENANT.id,
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
  it('returns per-type used/limit for the current month', async () => {
    const counts: Record<string, number> = {
      ai_creative: 2,
      social_media: 5,
      website_update: 1,
      report_request: 0,
    };
    dbMock.serviceRequest.count.mockImplementation((args: { where: { type: string } }) =>
      Promise.resolve(counts[args.where.type] ?? 0),
    );

    const usage = await getUsage();

    expect(usage).toEqual({
      ai_creative: { used: 2, limit: 4 },
      social_media: { used: 5, limit: 12 },
      website_update: { used: 1, limit: 4 },
      report_request: { used: 0, limit: 1 },
    });
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
