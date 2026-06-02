import Link from 'next/link';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { RevenueChart, type RevenuePoint } from '@/components/charts/RevenueChart';
import { ClientGrowthChart } from '@/components/charts/ClientGrowthChart';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/user';
import { formatDateTime, formatUSD } from '@/lib/format';

interface Revenue {
  currentMRR: number;
  premiumMRR: number;
  premiumCount: number;
  churnThisMonth: number;
  trialConversionsThisMonth: number;
  mrrByMonth: RevenuePoint[];
}

interface SubscriptionEventRow {
  id: string;
  eventType: string;
  fromTier: 'premium' | null;
  toTier: 'premium' | null;
  createdAt: string;
  tenant: { id: string; businessName: string; subscriptionTier: 'premium' };
}

/**
 * Derives a "new vs churned per month" series purely from `mrrByMonth`. The
 * delta in tenant count between consecutive months tells us net add — we
 * split it into adds (positive) and churned (negative). When we add a
 * dedicated cohort endpoint this can be replaced.
 */
function buildAddVsChurn(mrrByMonth: RevenuePoint[]) {
  return mrrByMonth.map((m, i, all) => {
    if (i === 0) return { month: m.month, newClients: 0 };
    const prev = all[i - 1]!;
    const prevCount = Math.round(prev.premium / 150);
    const thisCount = Math.round(m.premium / 150);
    const delta = thisCount - prevCount;
    return {
      month: m.month,
      newClients: Math.max(0, delta),
    };
  });
}

const EVENT_LABEL: Record<string, string> = {
  created: 'Subscription started',
  upgraded: 'Upgraded',
  downgraded: 'Downgraded',
  cancelled: 'Cancelled',
  reactivated: 'Reactivated',
  trial_started: 'Trial started',
  trial_ending: 'Trial ending',
  payment_failed: 'Payment failed',
  payment_succeeded: 'Payment succeeded',
};

export default async function RevenuePage() {
  const user = getCurrentUser();
  const [revenue, events] = await Promise.all([
    api<Revenue>('/api/admin/revenue'),
    api<SubscriptionEventRow[]>('/api/admin/subscription-events?limit=25'),
  ]);

  const addSeries = buildAddVsChurn(revenue.data.mrrByMonth);

  return (
    <PageWrapper
      title="Revenue"
      subtitle={`${formatUSD(revenue.data.currentMRR)} MRR · ${revenue.data.premiumCount} paying clients`}
      user={user}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Current MRR" value={formatUSD(revenue.data.currentMRR)} emphasis />
        <StatCard
          label="Premium MRR"
          value={formatUSD(revenue.data.premiumMRR)}
          hint={`${revenue.data.premiumCount} client${revenue.data.premiumCount === 1 ? '' : 's'} × $150`}
        />
        <StatCard
          label="Churn This Month"
          value={revenue.data.churnThisMonth}
          hint="Cancellation events"
        />
        <StatCard
          label="Trial Conversions"
          value={revenue.data.trialConversionsThisMonth}
          hint="This month"
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="MRR over time" action={<p className="text-xs text-ink-muted">Last 6 months</p>}>
          <RevenueChart data={revenue.data.mrrByMonth} />
        </Card>
        <Card title="New clients per month" action={<p className="text-xs text-ink-muted">Net adds</p>}>
          <ClientGrowthChart data={addSeries} />
        </Card>
      </div>

      <div className="mt-8">
        <Card
          title="Recent Subscription Events"
          action={<p className="text-xs text-ink-muted">Last 25</p>}
          dense
        >
          {events.data.length === 0 ? (
            <p className="px-4 py-6 text-sm text-ink-muted">No subscription activity yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-metal-deep/30 text-ink-muted">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em]">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em]">Event</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em]">Tier</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em]">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-metal-deep/20">
                {events.data.map((e) => (
                  <tr key={e.id} className="hover:bg-bg-raised/30">
                    <td className="px-4 py-3">
                      <Link href={`/clients/${e.tenant.id}`} className="text-ink-primary hover:text-metal-rose">
                        {e.tenant.businessName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {EVENT_LABEL[e.eventType] ?? e.eventType}
                    </td>
                    <td className="px-4 py-3">
                      {e.toTier ? (
                        <Badge tone={e.toTier}>{e.toTier}</Badge>
                      ) : e.fromTier ? (
                        <Badge tone={e.fromTier}>{e.fromTier}</Badge>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{formatDateTime(e.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </PageWrapper>
  );
}
