import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * adminService tests.
 *
 * Coverage:
 *   - listClients: search OR-clause, plan / status filters, sort dispatch,
 *     pagination math, MRR decoration.
 *   - getClient: 404 on unknown id, includes recent messages + sub events.
 *   - updateClient: 404 on unknown id, audit log fires.
 *   - listAllMessages: filters by status/tenant, returns unreadCount.
 *   - markMessageRead: 404 on unknown id, sets status to 'read'.
 *   - revenueOverview: MRR math from counts × PLAN price, includes mrrByMonth.
 *   - platformStats: returns the stat-card shape including unreadMessages.
 */

const { dbMock, eventMock } = vi.hoisted(() => ({
  dbMock: {
    tenant:            { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    message:           { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    subscriptionEvent: { count: vi.fn(), findMany: vi.fn() },
    user:              { count: vi.fn(), findMany: vi.fn() },
    platformEvent:     { count: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) =>
      Array.isArray(ops) ? Promise.all(ops as Promise<unknown>[]) : (ops as unknown),
    ),
    $queryRaw: vi.fn(),
  },
  eventMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/db.js', () => ({ db: dbMock, rawPrisma: dbMock }));
vi.mock('../../lib/tenantContext.js', () => ({
  getTenantId: () => 'tenant_test',
  getContext: () => ({ tenantId: null, userId: 'admin_1', role: 'platform_admin' }),
}));
vi.mock('../platformEventService.js', () => ({ logEvent: eventMock }));

import {
  listClients,
  getClient,
  updateClient,
  listAllMessages,
  markMessageRead,
  revenueOverview,
  platformStats,
} from '../adminService.js';

beforeEach(() => {
  Object.values(dbMock).forEach((m) => {
    if (typeof m === 'object' && m !== null) {
      Object.values(m).forEach((fn) => {
        if (typeof fn === 'function' && 'mockReset' in fn) fn.mockReset();
      });
    }
  });
  dbMock.$transaction.mockClear();
  dbMock.$transaction.mockImplementation(async (ops: unknown[]) =>
    Array.isArray(ops) ? Promise.all(ops as Promise<unknown>[]) : (ops as unknown),
  );
  dbMock.$queryRaw.mockReset().mockResolvedValue([]);
  eventMock.mockReset().mockResolvedValue(undefined);
});

// Single-plan model: every tenant is Premium.
const TENANT_A = {
  id: 't_1',
  businessName: 'Acme',
  subscriptionTier: 'premium' as const,
  subscriptionStatus: 'active' as const,
  isActive: true,
  createdAt: new Date('2026-05-01'),
  owner: { id: 'u_1', email: 'a@a.com', firstName: 'A', lastName: 'A', phone: null },
  _count: { messages: 3 },
};

const TENANT_B = {
  ...TENANT_A,
  id: 't_2',
  businessName: 'Beta',
};

describe('listClients', () => {
  it('returns rows + total with MRR decoration', async () => {
    dbMock.tenant.findMany.mockResolvedValue([TENANT_A, TENANT_B]);
    dbMock.tenant.count.mockResolvedValue(2);

    const result = await listClients({ page: 1, limit: 20 });

    expect(result.total).toBe(2);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]!.mrr).toBe(150);
    expect(result.rows[0]!.planName).toBe('Premium');
    expect(result.rows[1]!.mrr).toBe(150);
    expect(result.rows[1]!.planName).toBe('Premium');
  });

  it('builds an OR-search across business name, slug, and owner email', async () => {
    dbMock.tenant.findMany.mockResolvedValue([]);
    dbMock.tenant.count.mockResolvedValue(0);
    await listClients({ page: 1, limit: 20, search: 'acme' });
    const call = dbMock.tenant.findMany.mock.calls[0]![0];
    expect(call.where.OR).toEqual(
      expect.arrayContaining([
        { businessName: { contains: 'acme', mode: 'insensitive' } },
        { slug:         { contains: 'acme', mode: 'insensitive' } },
        { owner: { email: { contains: 'acme', mode: 'insensitive' } } },
      ]),
    );
  });

  it('applies plan and status filters together', async () => {
    dbMock.tenant.findMany.mockResolvedValue([]);
    dbMock.tenant.count.mockResolvedValue(0);
    await listClients({ page: 1, limit: 20, plan: 'premium', status: 'trialing' });
    const where = dbMock.tenant.findMany.mock.calls[0]![0].where;
    expect(where.subscriptionTier).toBe('premium');
    expect(where.subscriptionStatus).toBe('trialing');
  });

  it('dispatches sort by name / mrr / joined', async () => {
    dbMock.tenant.findMany.mockResolvedValue([]);
    dbMock.tenant.count.mockResolvedValue(0);

    await listClients({ page: 1, limit: 20, sort: 'name', order: 'asc' });
    expect(dbMock.tenant.findMany.mock.calls[0]![0].orderBy).toEqual({ businessName: 'asc' });

    await listClients({ page: 1, limit: 20, sort: 'mrr', order: 'desc' });
    expect(dbMock.tenant.findMany.mock.calls[1]![0].orderBy).toEqual({ subscriptionTier: 'desc' });

    await listClients({ page: 1, limit: 20, sort: 'joined' });
    expect(dbMock.tenant.findMany.mock.calls[2]![0].orderBy).toEqual({ createdAt: 'desc' });
  });

  it('paginates correctly (page 3, limit 10 → skip 20)', async () => {
    dbMock.tenant.findMany.mockResolvedValue([]);
    dbMock.tenant.count.mockResolvedValue(0);
    await listClients({ page: 3, limit: 10 });
    expect(dbMock.tenant.findMany.mock.calls[0]![0].skip).toBe(20);
    expect(dbMock.tenant.findMany.mock.calls[0]![0].take).toBe(10);
  });
});

describe('getClient', () => {
  it('404s on unknown id', async () => {
    dbMock.tenant.findUnique.mockResolvedValue(null);
    await expect(getClient('nope')).rejects.toMatchObject({ status: 404 });
  });

  it('decorates and includes recent messages + subscription events', async () => {
    dbMock.tenant.findUnique.mockResolvedValue(TENANT_B);
    dbMock.message.findMany.mockResolvedValue([{ id: 'm_1' }]);
    dbMock.subscriptionEvent.findMany.mockResolvedValue([{ id: 'se_1' }]);

    const result = await getClient('t_2');

    expect(result.mrr).toBe(150);
    expect(result.messages).toEqual([{ id: 'm_1' }]);
    expect(result.subscriptionEvents).toEqual([{ id: 'se_1' }]);
  });
});

describe('updateClient', () => {
  it('404s on unknown id', async () => {
    dbMock.tenant.findUnique.mockResolvedValue(null);
    await expect(updateClient('nope', { notes: 'x' })).rejects.toMatchObject({ status: 404 });
  });

  it('writes the update and logs an audit event', async () => {
    dbMock.tenant.findUnique.mockResolvedValue({ id: 't_1', isActive: true, notes: null });
    dbMock.tenant.update.mockResolvedValue(TENANT_A);

    const result = await updateClient('t_1', { notes: 'high touch' });

    expect(dbMock.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 't_1' }, data: { notes: 'high touch' } }),
    );
    expect(eventMock).toHaveBeenCalledWith(
      'admin.client_updated',
      expect.objectContaining({ clientId: 't_1' }),
    );
    expect(result.mrr).toBe(150);
  });
});

describe('listAllMessages', () => {
  it('filters by status + tenant and surfaces unreadCount', async () => {
    dbMock.message.findMany.mockResolvedValue([{ id: 'm_1' }]);
    dbMock.message.count
      .mockResolvedValueOnce(7)  // total for filter
      .mockResolvedValueOnce(3); // unreadCount overall

    const result = await listAllMessages({
      page: 1, limit: 20, status: 'unread', tenantId: 't_1',
    });

    expect(result.total).toBe(7);
    expect(result.unreadCount).toBe(3);
    const findMany = dbMock.message.findMany.mock.calls[0]![0];
    expect(findMany.where).toEqual({ status: 'unread', tenantId: 't_1' });
  });
});

describe('markMessageRead', () => {
  it('404s on unknown id', async () => {
    dbMock.message.findUnique.mockResolvedValue(null);
    await expect(markMessageRead('nope')).rejects.toMatchObject({ status: 404 });
  });

  it('sets status to read', async () => {
    dbMock.message.findUnique.mockResolvedValue({ id: 'm_1' });
    dbMock.message.update.mockResolvedValue({ id: 'm_1', status: 'read' });
    const result = await markMessageRead('m_1');
    expect(dbMock.message.update).toHaveBeenCalledWith({
      where: { id: 'm_1' },
      data: { status: 'read' },
    });
    expect(result.status).toBe('read');
  });
});

describe('revenueOverview', () => {
  it('computes MRR from the single Premium plan (premiumCount × $150)', async () => {
    dbMock.tenant.count.mockResolvedValueOnce(5); // premiumCount (all paying tenants)

    dbMock.subscriptionEvent.count
      .mockResolvedValueOnce(1)  // churnThisMonth
      .mockResolvedValueOnce(2); // conversionsThisMonth

    const now = new Date();
    const currentMonth = new Date(now);
    currentMonth.setUTCDate(1);
    currentMonth.setUTCHours(0, 0, 0, 0);

    dbMock.$queryRaw.mockResolvedValue([
      { month: currentMonth, count: 5n },
    ]);

    const result = await revenueOverview();

    expect(result.premiumCount).toBe(5);
    expect(result.premiumMRR).toBe(750); // 5 x $150
    expect(result.currentMRR).toBe(750);
    expect(result.churnThisMonth).toBe(1);
    expect(result.trialConversionsThisMonth).toBe(2);
    expect(result.mrrByMonth).toHaveLength(6);
    // Current month produced 5 premium -> 5 x $150 = $750.
    expect(result.mrrByMonth.at(-1)!.total).toBe(750);
  });
});

describe('platformStats', () => {
  it('returns the stat-card shape with unreadMessages + newThisMonth', async () => {
    dbMock.tenant.count
      .mockResolvedValueOnce(20)  // total
      .mockResolvedValueOnce(12)  // active
      .mockResolvedValueOnce(5)   // trialing
      .mockResolvedValueOnce(3);  // newThisMonth
    dbMock.message.count
      .mockResolvedValueOnce(40) // messagesThisMonth
      .mockResolvedValueOnce(7); // unread

    const result = await platformStats();

    expect(result).toEqual({
      totalTenants: 20,
      activeTenants: 12,
      trialingTenants: 5,
      newThisMonth: 3,
      messagesThisMonth: 40,
      unreadMessages: 7,
    });
  });
});
