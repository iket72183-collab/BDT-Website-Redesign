import { PageWrapper } from '@/components/layout/PageWrapper';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/user';
import { formatUSD } from '@/lib/format';

interface QueueCounts {
  waiting: number;
  active: number;
  delayed: number;
  completed: number;
  failed: number;
}

interface QueueHealth {
  queues: { platformEvents: QueueCounts };
  reachable: boolean;
}

/**
 * Plan prices are inlined here so the settings page is a read-only mirror
 * of `apps/api/src/lib/plans.ts`. Keep in sync — there's no fetch endpoint
 * because the prices don't change at runtime.
 */
// Single-plan model. Display-only mirror of apps/api/src/lib/plans.ts.
const PLAN_DISPLAY = [
  {
    id: 'premium',
    name: 'Premium',
    price: 150,
    features: [
      'Social media management',
      'Website maintenance & redesign',
      'AI-generated flyers & promo assets',
      'Unlimited service requests',
      '24/7 AI support',
      'Monthly performance reports',
    ],
  },
] as const;

const AGENCY_INBOX = 'BDTTalentGroup@yahoo.com';

export default async function SettingsPage() {
  const user = getCurrentUser();

  // Queue health is best-effort — Redis may be down without breaking the page.
  let queueHealth: QueueHealth | null = null;
  try {
    const res = await api<QueueHealth>('/api/admin/queue-health');
    queueHealth = res.data;
  } catch {
    queueHealth = null;
  }

  return (
    <PageWrapper title="Settings" subtitle="Admin profile, plans, and platform health" user={user}>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* --- Admin profile ----------------------------------------- */}
        <Card title="Admin profile">
          <dl className="space-y-3 text-sm">
            <Row label="Name">
              {user ? `${user.firstName} ${user.lastName}` : '—'}
            </Row>
            <Row label="Email">{user?.email ?? '—'}</Row>
            <Row label="Role"><Badge tone="premium">Platform admin</Badge></Row>
          </dl>
          <p className="mt-4 text-xs text-ink-subtle">
            Password changes go through the standard reset flow:
            sign out → "Forgot password" on the login screen.
          </p>
        </Card>

        {/* --- Notification routing ---------------------------------- */}
        <Card title="Notification routing">
          <dl className="space-y-3 text-sm">
            <Row label="Inbound messages">
              <a href={`mailto:${AGENCY_INBOX}`} className="text-metal-rose hover:underline">
                {AGENCY_INBOX}
              </a>
            </Row>
            <Row label="Sender (Resend)">
              <code className="font-mono text-xs text-ink-muted">noreply@bdtconnect.com</code>
            </Row>
            <Row label="Push fan-out">
              <span className="text-ink-muted">All platform admins (device push tokens)</span>
            </Row>
          </dl>
          <p className="mt-4 text-xs text-ink-subtle">
            To change the agency inbox, update <code className="font-mono">AGENCY_INBOX</code>{' '}
            in <code className="font-mono">apps/api/src/services/messageService.ts</code>.
          </p>
        </Card>

        {/* --- Plans -------------------------------------------------- */}
        <Card title="Plans" action={<p className="text-xs text-ink-muted">Display only</p>}>
          <ul className="space-y-4">
            {PLAN_DISPLAY.map((plan) => (
              <li key={plan.id} className="rounded-lg border border-metal-deep/30 p-4">
                <div className="mb-2 flex items-baseline justify-between">
                  <div className="flex items-center gap-2">
                    <Badge tone={plan.id}>{plan.name}</Badge>
                  </div>
                  <p className="font-display text-2xl font-bold text-metal-rose">
                    {formatUSD(plan.price)}<span className="ml-1 text-xs text-ink-muted">/mo</span>
                  </p>
                </div>
                <ul className="space-y-1 text-xs text-ink-muted">
                  {plan.features.map((f) => (
                    <li key={f}>· {f}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-ink-subtle">
            To change the price, update the Stripe product price ID
            (<code className="font-mono">STRIPE_PREMIUM_PRICE_ID</code>) and{' '}
            <code className="font-mono">apps/api/src/lib/plans.ts</code>.
          </p>
        </Card>

        {/* --- Queue health ------------------------------------------ */}
        <Card title="Queue health" action={
          queueHealth ? (
            <Badge tone={queueHealth.reachable ? 'active' : 'past_due'}>
              {queueHealth.reachable ? 'Reachable' : 'Unreachable'}
            </Badge>
          ) : (
            <Badge tone="past_due">Error</Badge>
          )
        }>
          {queueHealth ? (
            <QueueRow name="platform-events" counts={queueHealth.queues.platformEvents} />
          ) : (
            <p className="text-sm text-ink-muted">
              Couldn't reach the queue health endpoint. Check the API logs.
            </p>
          )}
          <p className="mt-4 text-xs text-ink-subtle">
            Source: <code className="font-mono">GET /api/admin/queue-health</code>. Backed by
            BullMQ + Redis. If queues are unreachable the API still serves requests, but
            push receipts and async audit writes will lag.
          </p>
        </Card>
      </div>
    </PageWrapper>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-baseline gap-3">
      <dt className="text-xs uppercase tracking-[0.18em] text-ink-subtle">{label}</dt>
      <dd className="text-sm text-ink-primary">{children}</dd>
    </div>
  );
}

function QueueRow({ name, counts }: { name: string; counts: QueueCounts }) {
  const cells: Array<[keyof QueueCounts, string]> = [
    ['waiting',   'Waiting'],
    ['active',    'Active'],
    ['delayed',   'Delayed'],
    ['completed', 'Completed'],
    ['failed',    'Failed'],
  ];
  return (
    <div>
      <p className="mb-3 font-mono text-sm text-ink-primary">{name}</p>
      <dl className="grid grid-cols-5 gap-3 text-center">
        {cells.map(([k, label]) => (
          <div key={k} className="rounded-lg border border-metal-deep/30 bg-bg-inset p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-ink-subtle">{label}</p>
            <p
              className={
                'mt-1 font-display text-xl font-bold ' +
                (k === 'failed' && counts.failed > 0 ? 'text-status-danger' : 'text-ink-primary')
              }
            >
              {counts[k]}
            </p>
          </div>
        ))}
      </dl>
    </div>
  );
}
