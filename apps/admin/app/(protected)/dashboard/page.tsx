import Link from 'next/link';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { RevenueChart, type RevenuePoint } from '@/components/charts/RevenueChart';
import { ClientGrowthChart, type GrowthPoint } from '@/components/charts/ClientGrowthChart';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/user';
import { formatDate, formatUSD } from '@/lib/format';

interface Stats {
  totalTenants: number;
  activeTenants: number;
  trialingTenants: number;
  newThisMonth: number;
  messagesThisMonth: number;
  unreadMessages: number;
}

interface Revenue {
  currentMRR: number;
  basicMRR: number;
  premiumMRR: number;
  basicCount: number;
  premiumCount: number;
  churnThisMonth: number;
  trialConversionsThisMonth: number;
  mrrByMonth: RevenuePoint[];
}

interface ClientRow {
  id: string;
  businessName: string;
  subscriptionTier: 'basic' | 'premium';
  subscriptionStatus: 'incomplete' | 'active' | 'trialing' | 'past_due' | 'cancelled';
  createdAt: string;
  mrr: number;
  planName: string;
  owner: { firstName: string; lastName: string; email: string } | null;
}

interface MessageRow {
  id: string;
  subject: string | null;
  status: 'unread' | 'read' | 'archived';
  sentAt: string;
  tenant: { id: string; businessName: string };
}

interface MessagesEnvelope {
  rows: MessageRow[];
  unreadCount: number;
}

const STATUS_TONE: Record<ClientRow['subscriptionStatus'], BadgeTone> = {
  incomplete: 'incomplete',
  active: 'active',
  trialing: 'trialing',
  past_due: 'past_due',
  cancelled: 'cancelled',
};

async function loadDashboard(): Promise<{
  stats: Stats;
  revenue: Revenue;
  recentClients: ClientRow[];
  recentMessages: MessageRow[];
  growth: GrowthPoint[];
}> {
  const [stats, revenue, clients, messages] = await Promise.all([
    api<Stats>('/api/admin/stats'),
    api<Revenue>('/api/admin/revenue'),
    api<ClientRow[]>('/api/admin/clients?limit=5&sort=joined&order=desc'),
    api<MessagesEnvelope>('/api/admin/messages?limit=5'),
  ]);

  // Growth chart derived from `mrrByMonth` count proxy. Real "new clients per
  // month" isn't stored as a series; we'd need a dedicated endpoint or
  // analytical query. For now we estimate from MRR deltas → clients added per
  // tier × prior month's count. Approximate, but useful for the trend feel.
  const growth: GrowthPoint[] = revenue.data.mrrByMonth.map((m, i, all) => {
    if (i === 0) return { month: m.month, newClients: 0 };
    const prev = all[i - 1]!;
    const basicDelta   = Math.max(0, (m.basic   / 100) - (prev.basic   / 100));
    const premiumDelta = Math.max(0, (m.premium / 175) - (prev.premium / 175));
    return { month: m.month, newClients: basicDelta + premiumDelta };
  });

  return {
    stats: stats.data,
    revenue: revenue.data,
    recentClients: clients.data,
    recentMessages: messages.data.rows,
    growth,
  };
}

export default async function DashboardPage() {
  const user = getCurrentUser();
  const { stats, revenue, recentClients, recentMessages, growth } = await loadDashboard();

  return (
    <PageWrapper
      title="Dashboard"
      subtitle={`${stats.activeTenants + stats.trialingTenants} active clients · ${formatUSD(revenue.currentMRR)} MRR`}
      user={user}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active Clients"
          value={stats.activeTenants + stats.trialingTenants}
          hint={`${stats.activeTenants} paid · ${stats.trialingTenants} trial`}
        />
        <StatCard
          label="Monthly Recurring Revenue"
          value={formatUSD(revenue.currentMRR)}
          hint={`Basic ${formatUSD(revenue.basicMRR)} · Premium ${formatUSD(revenue.premiumMRR)}`}
          emphasis
        />
        <StatCard
          label="New This Month"
          value={stats.newThisMonth}
          hint={`${revenue.trialConversionsThisMonth} trial conversions`}
        />
        <StatCard
          label="Unread Messages"
          value={stats.unreadMessages}
          hint={`${stats.messagesThisMonth} total this month`}
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card title="MRR over time" action={<p className="text-xs text-ink-muted">Last 6 months</p>}>
            <RevenueChart data={revenue.mrrByMonth} />
          </Card>
        </div>

        <Card title="Plan Breakdown">
          <PlanBreakdownRow
            name="Basic"
            count={revenue.basicCount}
            mrr={revenue.basicMRR}
            unitPrice={100}
            tone="basic"
          />
          <div className="my-4 h-px bg-metal-deep/30" />
          <PlanBreakdownRow
            name="Premium"
            count={revenue.premiumCount}
            mrr={revenue.premiumMRR}
            unitPrice={175}
            tone="premium"
          />
          <div className="my-4 h-px bg-metal-deep/30" />
          <div className="flex items-baseline justify-between">
            <p className="label">Total</p>
            <p className="font-display text-2xl font-bold text-metal-rose">
              {formatUSD(revenue.currentMRR)}
            </p>
          </div>
        </Card>
      </div>

      <div className="mt-8">
        <Card title="Client Growth" action={<p className="text-xs text-ink-muted">New clients per month</p>}>
          <ClientGrowthChart data={growth} />
        </Card>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card
          title="Recent Messages"
          action={
            <Link href="/messages" className="text-xs text-metal-rose hover:underline">
              View all →
            </Link>
          }
          dense
        >
          {recentMessages.length === 0 ? (
            <p className="px-4 py-6 text-sm text-ink-muted">No messages yet.</p>
          ) : (
            <ul className="divide-y divide-metal-deep/20">
              {recentMessages.map((m) => (
                <li key={m.id} className="px-4 py-3">
                  <Link href="/messages" className="flex items-center justify-between hover:bg-bg-raised/40">
                    <div>
                      <p className="text-sm font-medium text-ink-primary">{m.tenant.businessName}</p>
                      <p className="text-xs text-ink-muted">{m.subject ?? 'No subject'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-ink-subtle">{formatDate(m.sentAt)}</span>
                      {m.status === 'unread' && <Badge tone="unread">New</Badge>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Recent Signups"
          action={
            <Link href="/clients" className="text-xs text-metal-rose hover:underline">
              View all →
            </Link>
          }
          dense
        >
          {recentClients.length === 0 ? (
            <p className="px-4 py-6 text-sm text-ink-muted">No clients yet.</p>
          ) : (
            <ul className="divide-y divide-metal-deep/20">
              {recentClients.map((c) => (
                <li key={c.id} className="px-4 py-3">
                  <Link
                    href={`/clients/${c.id}`}
                    className="flex items-center justify-between hover:bg-bg-raised/40"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink-primary">{c.businessName}</p>
                      <p className="text-xs text-ink-muted">
                        {c.owner ? `${c.owner.firstName} ${c.owner.lastName}` : '—'} ·{' '}
                        {formatDate(c.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={c.subscriptionTier}>{c.planName}</Badge>
                      <Badge tone={STATUS_TONE[c.subscriptionStatus]}>{c.subscriptionStatus}</Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </PageWrapper>
  );
}

interface PlanBreakdownRowProps {
  name: string;
  count: number;
  mrr: number;
  unitPrice: number;
  tone: BadgeTone;
}

function PlanBreakdownRow({ name, count, mrr, unitPrice, tone }: PlanBreakdownRowProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Badge tone={tone}>{name}</Badge>
        <p className="text-sm text-ink-muted">
          {count} client{count === 1 ? '' : 's'} · {formatUSD(unitPrice)}/mo
        </p>
      </div>
      <p className="font-display text-lg font-semibold text-ink-primary">{formatUSD(mrr)}</p>
    </div>
  );
}
