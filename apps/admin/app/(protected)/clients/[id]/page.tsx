import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { Card } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { api, ApiError } from '@/lib/api';
import { getCurrentUser } from '@/lib/user';
import { formatDate, formatDateTime, formatUSD } from '@/lib/format';
import { ClientEditor } from './ClientEditor';

interface ClientDetail {
  id: string;
  businessName: string;
  slug: string;
  subscriptionTier: 'basic' | 'premium';
  subscriptionStatus: 'incomplete' | 'active' | 'trialing' | 'past_due' | 'cancelled';
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  tiktokUrl: string | null;
  googleBusinessUrl: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  onboardingCompleted: boolean;
  onboardingCompletedAt: string | null;
  mrr: number;
  planName: string;
  owner: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
  } | null;
  messages: Array<{
    id: string;
    subject: string | null;
    body: string;
    status: 'unread' | 'read' | 'archived';
    sentAt: string;
  }>;
  subscriptionEvents: Array<{
    id: string;
    eventType: string;
    fromTier: string | null;
    toTier: string | null;
    createdAt: string;
  }>;
}

const STATUS_TONE: Record<ClientDetail['subscriptionStatus'], BadgeTone> = {
  incomplete: 'incomplete',
  active: 'active',
  trialing: 'trialing',
  past_due: 'past_due',
  cancelled: 'cancelled',
};

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const user = getCurrentUser();
  let client: ClientDetail;
  try {
    const res = await api<ClientDetail>(`/api/admin/clients/${params.id}`);
    client = res.data;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  return (
    <PageWrapper
      title={client.businessName}
      subtitle={`${client.slug} · joined ${formatDate(client.createdAt)}`}
      user={user}
    >
      <div className="mb-6">
        <Link href="/clients" className="text-xs text-metal-rose hover:underline">
          ← All clients
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* --- Business info ------------------------------------------ */}
        <Card title="Business" >
          <dl className="space-y-3 text-sm">
            <Row label="Owner">
              {client.owner ? (
                <>
                  <div>{client.owner.firstName} {client.owner.lastName}</div>
                  <div className="text-xs text-ink-muted">{client.owner.email}</div>
                  {client.owner.phone && (
                    <div className="text-xs text-ink-muted">{client.owner.phone}</div>
                  )}
                </>
              ) : '—'}
            </Row>
            <Row label="Onboarding">
              {client.onboardingCompleted ? (
                <span className="text-status-success">
                  Completed{client.onboardingCompletedAt ? ` ${formatDate(client.onboardingCompletedAt)}` : ''}
                </span>
              ) : (
                <span className="text-status-warning">Pending</span>
              )}
            </Row>
            <Row label="Website">
              {client.websiteUrl ? (
                <a href={client.websiteUrl} target="_blank" rel="noreferrer" className="text-metal-rose hover:underline">
                  {client.websiteUrl}
                </a>
              ) : (
                <span className="text-ink-subtle">Not set</span>
              )}
            </Row>
            <Row label="Social">
              <SocialList client={client} />
            </Row>
          </dl>
        </Card>

        {/* --- Subscription ------------------------------------------- */}
        <Card title="Subscription">
          <div className="flex items-center gap-2">
            <Badge tone={client.subscriptionTier}>{client.planName}</Badge>
            <Badge tone={STATUS_TONE[client.subscriptionStatus]}>{client.subscriptionStatus}</Badge>
          </div>
          <p className="mt-4 font-display text-3xl font-bold text-metal-rose">
            {formatUSD(client.mrr)}<span className="ml-1 text-sm text-ink-muted">/mo</span>
          </p>
          <dl className="mt-4 space-y-2 text-xs text-ink-muted">
            <Row label="Stripe customer">
              <code className="font-mono text-xs text-ink-muted">
                {client.stripeCustomerId ?? '—'}
              </code>
            </Row>
            <Row label="Subscription id">
              <code className="font-mono text-xs text-ink-muted">
                {client.stripeSubscriptionId ?? '—'}
              </code>
            </Row>
          </dl>
          {client.stripeCustomerId && (
            <a
              href={`https://dashboard.stripe.com/customers/${client.stripeCustomerId}`}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost mt-4 inline-block rounded-lg px-4 py-2 text-xs uppercase tracking-[0.18em]"
            >
              Open in Stripe →
            </a>
          )}
        </Card>

        {/* --- Subscription events ------------------------------------ */}
        <Card title="Subscription events" dense>
          {client.subscriptionEvents.length === 0 ? (
            <p className="px-4 py-6 text-sm text-ink-muted">No events yet.</p>
          ) : (
            <ul className="divide-y divide-metal-deep/20">
              {client.subscriptionEvents.map((e) => (
                <li key={e.id} className="px-4 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-ink-primary">{e.eventType.replace(/_/g, ' ')}</span>
                    <span className="text-xs text-ink-subtle">{formatDate(e.createdAt)}</span>
                  </div>
                  {(e.fromTier || e.toTier) && (
                    <div className="text-xs text-ink-muted">
                      {e.fromTier ?? '—'} → {e.toTier ?? '—'}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* --- Messages history (2/3) --------------------------------- */}
        <div className="xl:col-span-2">
          <Card title="Messages" action={<Link href="/messages" className="text-xs text-metal-rose hover:underline">Inbox →</Link>} dense>
            {client.messages.length === 0 ? (
              <p className="px-4 py-6 text-sm text-ink-muted">No messages from this client yet.</p>
            ) : (
              <ul className="divide-y divide-metal-deep/20">
                {client.messages.map((m) => (
                  <li key={m.id} className="px-4 py-4">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-sm font-medium text-ink-primary">
                        {m.subject ?? 'No subject'}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge tone={m.status === 'unread' ? 'unread' : 'read'}>
                          {m.status}
                        </Badge>
                        <span className="text-xs text-ink-subtle">{formatDateTime(m.sentAt)}</span>
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-ink-muted">{m.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* --- Admin actions (1/3) ------------------------------------- */}
        <Card title="Admin">
          <ClientEditor
            clientId={client.id}
            initial={{
              notes: client.notes,
              isActive: client.isActive,
              businessName: client.businessName,
            }}
          />
        </Card>
      </div>
    </PageWrapper>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-baseline gap-3">
      <dt className="text-xs uppercase tracking-[0.18em] text-ink-subtle">{label}</dt>
      <dd className="text-sm text-ink-primary">{children}</dd>
    </div>
  );
}

function SocialList({ client }: { client: ClientDetail }) {
  const items: Array<{ label: string; href: string | null }> = [
    { label: 'Instagram',       href: client.instagramUrl },
    { label: 'Facebook',        href: client.facebookUrl },
    { label: 'TikTok',          href: client.tiktokUrl },
    { label: 'Google Business', href: client.googleBusinessUrl },
  ];
  const set = items.filter((i) => i.href);
  if (set.length === 0) return <span className="text-ink-subtle">None linked</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {set.map((i) => (
        <a
          key={i.label}
          href={i.href!}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-metal-deep/50 px-3 py-1 text-xs text-ink-muted hover:border-metal-rose hover:text-metal-rose"
        >
          {i.label}
        </a>
      ))}
    </div>
  );
}
