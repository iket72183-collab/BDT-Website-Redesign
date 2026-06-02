import type { Prisma, SubscriptionStatus, SubscriptionTier, MessageStatus } from '@prisma/client';
import { rawPrisma } from '../lib/db.js';
import { USER_PUBLIC } from '../lib/userSelect.js';
import { HttpError } from '../middleware/error.js';
import { logEvent } from './platformEventService.js';
import { PLANS } from '../lib/plans.js';

/**
 * Platform-admin queries bypass tenant scoping. We use `rawPrisma` directly
 * so the Prisma extension's tenant filter does NOT apply — admins see all
 * tenants.
 *
 * In the agency-portal model "tenant" and "client" are the same row — the
 * tenant IS the client. Functions are named `*Client*` here to match the
 * vocabulary the admin web app uses; legacy `listTenants`/`getTenant`
 * wrappers stay around for any internal callers.
 */

// ============================================================================
// §CLIENTS — list / detail / patch
// ============================================================================

type ClientSort = 'joined' | 'mrr' | 'name';
type SortOrder = 'asc' | 'desc';

interface ListClientsInput {
  page: number;
  limit: number;
  search?: string;
  plan?: SubscriptionTier;
  status?: SubscriptionStatus;
  sort?: ClientSort;
  order?: SortOrder;
}

/**
 * Admin client list with search, plan + status filters, sort + pagination.
 * Single-plan model: every tenant is Premium, so the `mrr` sort (on
 * `subscriptionTier`) is effectively a no-op and `createdAt` is the practical
 * order.
 */
export async function listClients(input: ListClientsInput) {
  const where: Prisma.TenantWhereInput = {
    ...(input.plan ? { subscriptionTier: input.plan } : {}),
    ...(input.status ? { subscriptionStatus: input.status } : {}),
    ...(input.search
      ? {
          OR: [
            { businessName: { contains: input.search, mode: 'insensitive' } },
            { slug:         { contains: input.search, mode: 'insensitive' } },
            { owner: { email: { contains: input.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const orderBy: Prisma.TenantOrderByWithRelationInput = (() => {
    const dir: SortOrder = input.order ?? 'desc';
    switch (input.sort) {
      case 'name': return { businessName: dir };
      case 'mrr':  return { subscriptionTier: dir };
      case 'joined':
      default:     return { createdAt: dir };
    }
  })();

  const [rows, total] = await rawPrisma.$transaction([
    rawPrisma.tenant.findMany({
      where,
      orderBy,
      skip: (input.page - 1) * input.limit,
      take: input.limit,
      include: {
        owner: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
        _count: { select: { messages: true } },
      },
    }),
    rawPrisma.tenant.count({ where }),
  ]);

  return {
    rows: rows.map(decorateClient),
    total,
  };
}

/**
 * Full client detail: tenant + owner + last 10 messages + last 10 subscription
 * events. Used by the admin client-detail page.
 */
export async function getClient(id: string) {
  const tenant = await rawPrisma.tenant.findUnique({
    where: { id },
    include: {
      owner: { select: USER_PUBLIC },
      _count: { select: { messages: true } },
    },
  });
  if (!tenant) throw new HttpError(404, 'not_found', 'not_found');

  const [messages, subscriptionEvents] = await Promise.all([
    rawPrisma.message.findMany({
      where: { tenantId: id },
      orderBy: { sentAt: 'desc' },
      take: 10,
    }),
    rawPrisma.subscriptionEvent.findMany({
      where: { tenantId: id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  return {
    ...decorateClient(tenant),
    owner: tenant.owner,
    messages,
    subscriptionEvents,
  };
}

interface UpdateClientInput {
  notes?: string | null;
  isActive?: boolean;
  /** Admin-only override; surfaces in the danger zone. */
  subscriptionTier?: SubscriptionTier;
  subscriptionStatus?: SubscriptionStatus;
}

export async function updateClient(id: string, data: UpdateClientInput) {
  const before = await rawPrisma.tenant.findUnique({
    where: { id },
    select: { id: true, isActive: true, notes: true },
  });
  if (!before) throw new HttpError(404, 'not_found', 'not_found');

  const updated = await rawPrisma.tenant.update({
    where: { id },
    data,
    include: {
      owner: { select: USER_PUBLIC },
      _count: { select: { messages: true } },
    },
  });
  await logEvent('admin.client_updated', { clientId: id, changes: data as Prisma.InputJsonValue });
  return decorateClient(updated);
}

// ============================================================================
// §MESSAGES — cross-tenant inbox
// ============================================================================

interface ListAllMessagesInput {
  page: number;
  limit: number;
  status?: MessageStatus;
  tenantId?: string;
}

/**
 * Cross-tenant message inbox. Includes the sending tenant + user so the UI
 * can render "Business / From / Subject" without N+1 lookups.
 */
export async function listAllMessages(input: ListAllMessagesInput) {
  const where: Prisma.MessageWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.tenantId ? { tenantId: input.tenantId } : {}),
  };
  const [rows, total, unreadCount] = await rawPrisma.$transaction([
    rawPrisma.message.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
      include: {
        tenant: { select: { id: true, businessName: true, subscriptionTier: true } },
        user:   { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    }),
    rawPrisma.message.count({ where }),
    rawPrisma.message.count({ where: { status: 'unread' } }),
  ]);
  return { rows, total, unreadCount };
}

export async function markMessageRead(id: string) {
  const existing = await rawPrisma.message.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'not_found', 'not_found');
  const updated = await rawPrisma.message.update({
    where: { id },
    data: { status: 'read' },
  });
  await logEvent('admin.message_marked_read', { messageId: id });
  return updated;
}

// ============================================================================
// §REVENUE — MRR snapshots + churn / conversions
// ============================================================================

export interface MRRSnapshot {
  month: string;             // ISO date — first of the month, UTC
  premium: number;           // dollars
  total: number;
}

export interface RevenueOverview {
  currentMRR: number;
  premiumMRR: number;
  premiumCount: number;
  churnThisMonth: number;
  trialConversionsThisMonth: number;
  mrrByMonth: MRRSnapshot[];
}

/**
 * Single-plan revenue. Active-paying definition: subscription_status IN
 * (active, trialing) — every paying tenant is on the Premium plan, so MRR is
 * simply premiumCount × the Premium price.
 */
export async function revenueOverview(): Promise<RevenueOverview> {
  const now = new Date();
  const monthStart = startOfMonthUTC(now);

  const [premiumCount, churnThisMonth, trialConversionsThisMonth] =
    await rawPrisma.$transaction([
      rawPrisma.tenant.count({
        where: {
          subscriptionTier: 'premium',
          subscriptionStatus: { in: ['active', 'trialing'] },
        },
      }),
      rawPrisma.subscriptionEvent.count({
        where: { eventType: 'cancelled', createdAt: { gte: monthStart } },
      }),
      // Conversions = first `payment_succeeded` events this month (a tenant
      // moving from any non-paying state to paid).
      rawPrisma.subscriptionEvent.count({
        where: { eventType: 'payment_succeeded', createdAt: { gte: monthStart } },
      }),
    ]);

  const premiumMRR = premiumCount * PLANS.premium.price;

  return {
    currentMRR: premiumMRR,
    premiumMRR,
    premiumCount,
    churnThisMonth,
    trialConversionsThisMonth,
    mrrByMonth: await mrrByMonth(now, 6),
  };
}

/**
 * For each of the last `monthCount` months, approximate MRR as:
 *   tenants where created_at <= end_of_month
 *           AND is_active = true
 *           AND (no `cancelled` subscription_event before end_of_month)
 * times PLANS[tier].price.
 *
 * Imperfect — doesn't account for mid-month tier changes or churn that
 * happened then reversed — but a useful rough trend line. When we need
 * point-in-time perfection, layer in a daily MRR snapshot job.
 */
async function mrrByMonth(now: Date, monthCount: number): Promise<MRRSnapshot[]> {
  const queryResult = await rawPrisma.$queryRaw<
    Array<{
      month: Date;
      count: bigint;
    }>
  >`
    SELECT
      date_trunc('month', created_at) AS month,
      COUNT(*) AS count
    FROM tenants
    WHERE
      created_at >= NOW() - INTERVAL '6 months'
      AND subscription_status IN ('active', 'trialing')
      AND subscription_tier = 'premium'
    GROUP BY
      date_trunc('month', created_at)
    ORDER BY
      month ASC
  `;

  const out: MRRSnapshot[] = [];
  for (let i = monthCount - 1; i >= 0; i--) {
    const start = startOfMonthUTC(now);
    start.setUTCMonth(start.getUTCMonth() - i);
    const monthStr = start.toISOString().slice(0, 10);

    const matchingRows = queryResult.filter(
      (r) => r.month.toISOString().slice(0, 10) === monthStr
    );

    let premiumCount = 0;
    for (const row of matchingRows) {
      premiumCount += Number(row.count);
    }

    const premiumMRR = premiumCount * PLANS.premium.price;
    out.push({
      month: monthStr,
      premium: premiumMRR,
      total: premiumMRR,
    });
  }

  return out;
}

function startOfMonthUTC(d: Date): Date {
  const out = new Date(d);
  out.setUTCDate(1);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

// ============================================================================
// §LEGACY — used by /api/admin/tenants which we keep around for back-compat.
// ============================================================================

interface ListTenantsInput {
  page: number;
  limit: number;
  search?: string;
  status?: SubscriptionStatus;
}

export function listTenants(input: ListTenantsInput) {
  return listClients({ ...input, sort: 'joined', order: 'desc' });
}

export function getTenant(id: string) {
  return getClient(id);
}

export function updateTenant(id: string, data: UpdateClientInput) {
  return updateClient(id, data);
}

// ============================================================================
// §USERS / §STATS / §EVENTS
// ============================================================================

export async function listAllUsers(input: { page: number; limit: number }) {
  // USER_PUBLIC + a tiny tenant projection — guarantees passwordHash never
  // shows up in the admin "all users" list either.
  const [rows, total] = await rawPrisma.$transaction([
    rawPrisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
      select: {
        ...USER_PUBLIC,
        tenant: { select: { id: true, slug: true, businessName: true } },
      },
    }),
    rawPrisma.user.count(),
  ]);
  return { rows, total };
}

/** Platform-wide health metrics. Backs the dashboard stat cards. */
export async function platformStats() {
  const monthStart = startOfMonthUTC(new Date());

  const [
    totalTenants,
    activeTenants,
    trialingTenants,
    newThisMonth,
    messagesThisMonth,
    unreadMessages,
  ] = await rawPrisma.$transaction([
    rawPrisma.tenant.count(),
    rawPrisma.tenant.count({ where: { subscriptionStatus: 'active' } }),
    rawPrisma.tenant.count({ where: { subscriptionStatus: 'trialing' } }),
    rawPrisma.tenant.count({ where: { createdAt: { gte: monthStart } } }),
    rawPrisma.message.count({ where: { sentAt: { gte: monthStart } } }),
    rawPrisma.message.count({ where: { status: 'unread' } }),
  ]);
  return {
    totalTenants,
    activeTenants,
    trialingTenants,
    newThisMonth,
    messagesThisMonth,
    unreadMessages,
  };
}

interface ListEventsInput {
  page: number;
  limit: number;
  eventType?: string;
  tenantId?: string;
  from?: string;
  to?: string;
}

export async function listPlatformEvents(input: ListEventsInput) {
  const where: Prisma.PlatformEventWhereInput = {
    ...(input.eventType ? { eventType: input.eventType } : {}),
    ...(input.tenantId ? { tenantId: input.tenantId } : {}),
    ...(input.from || input.to
      ? {
          createdAt: {
            ...(input.from ? { gte: new Date(input.from) } : {}),
            ...(input.to ? { lt: new Date(input.to) } : {}),
          },
        }
      : {}),
  };
  const [rows, total] = await rawPrisma.$transaction([
    rawPrisma.platformEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
    rawPrisma.platformEvent.count({ where }),
  ]);
  return { rows, total };
}

interface ListSubscriptionEventsInput {
  page: number;
  limit: number;
  eventType?: string;
  tenantId?: string;
}

export async function listSubscriptionEvents(input: ListSubscriptionEventsInput) {
  const where: Prisma.SubscriptionEventWhereInput = {
    ...(input.eventType ? { eventType: input.eventType as never } : {}),
    ...(input.tenantId ? { tenantId: input.tenantId } : {}),
  };
  const [rows, total] = await rawPrisma.$transaction([
    rawPrisma.subscriptionEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
      include: {
        tenant: { select: { id: true, businessName: true, subscriptionTier: true } },
      },
    }),
    rawPrisma.subscriptionEvent.count({ where }),
  ]);
  return { rows, total };
}

// ============================================================================
// helpers
// ============================================================================

type TenantRow = Prisma.TenantGetPayload<{
  include: {
    owner: { select: typeof USER_PUBLIC };
    _count: { select: { messages: true } };
  };
}> | Prisma.TenantGetPayload<{
  include: {
    owner: { select: { id: true; email: true; firstName: true; lastName: true; phone: true } };
    _count: { select: { messages: true } };
  };
}>;

/**
 * Stamp the computed monthly-recurring-revenue contribution onto a tenant
 * row. Done in the service so callers don't re-import PLANS everywhere.
 */
function decorateClient<T extends { subscriptionTier: SubscriptionTier }>(
  tenant: T,
): T & { mrr: number; planName: string } {
  return {
    ...tenant,
    mrr: PLANS[tenant.subscriptionTier].price,
    planName: PLANS[tenant.subscriptionTier].name,
  };
}

