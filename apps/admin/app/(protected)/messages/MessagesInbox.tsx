'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDateTime } from '@/lib/format';

export interface MessageRow {
  id: string;
  subject: string | null;
  body: string;
  status: 'unread' | 'read' | 'archived';
  emailDeliveryStatus: 'pending' | 'sent' | 'failed';
  sentAt: string;
  tenant: { id: string; businessName: string; subscriptionTier: 'premium' };
  user: { id: string; email: string; firstName: string; lastName: string };
}

interface Props {
  messages: MessageRow[];
  initialStatus: 'unread' | 'read' | '';
}

const PLAN_TONE: Record<MessageRow['tenant']['subscriptionTier'], BadgeTone> = {
  premium: 'premium',
};

/**
 * Two-pane inbox. List on the left (filterable), detail on the right.
 * The selection lives in the URL (`?id=…`) so deep links and back/forward
 * navigation work. Marking-as-read mutates server-side, then `router.refresh`
 * re-fetches the list so the sidebar badge updates too.
 */
export function MessagesInbox({ messages, initialStatus }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get('id');
  const selected = messages.find((m) => m.id === selectedId) ?? messages[0] ?? null;

  const setQuery = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') params.delete(k);
      else params.set(k, v);
    }
    router.push(`/messages?${params.toString()}`);
  };

  return (
    <div className="grid h-[calc(100vh-12rem)] grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
      {/* --- List ----------------------------------------------------- */}
      <div className="flex flex-col overflow-hidden">
        <div className="mb-3 flex gap-2">
          <FilterChip
            active={initialStatus === ''}
            onClick={() => setQuery({ status: null })}
          >
            All
          </FilterChip>
          <FilterChip
            active={initialStatus === 'unread'}
            onClick={() => setQuery({ status: 'unread' })}
          >
            Unread
          </FilterChip>
          <FilterChip
            active={initialStatus === 'read'}
            onClick={() => setQuery({ status: 'read' })}
          >
            Read
          </FilterChip>
        </div>

        <div className="glass flex-1 overflow-y-auto p-0">
          {messages.length === 0 ? (
            <EmptyState
              title="No messages"
              body={initialStatus === 'unread' ? 'Inbox zero. 🎯' : 'Nothing here yet.'}
            />
          ) : (
            <ul className="divide-y divide-metal-deep/20">
              {messages.map((m) => {
                const isActive = selected?.id === m.id;
                return (
                  <li key={m.id}>
                    <Link
                      href={`/messages?${new URLSearchParams({
                        ...(initialStatus ? { status: initialStatus } : {}),
                        id: m.id,
                      }).toString()}`}
                      className={
                        'block px-4 py-4 transition ' +
                        (isActive ? 'bg-metal-rose/10' : 'hover:bg-bg-raised/40')
                      }
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-sm font-semibold text-ink-primary">
                          {m.tenant.businessName}
                        </p>
                        {m.status === 'unread' && (
                          <span aria-hidden className="h-2 w-2 rounded-full bg-metal-rose" />
                        )}
                      </div>
                      <p className="text-sm text-ink-muted line-clamp-1">
                        {m.subject ?? 'No subject'}
                      </p>
                      <p className="mt-1 text-xs text-ink-subtle">{formatDateTime(m.sentAt)}</p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* --- Detail --------------------------------------------------- */}
      <div className="glass overflow-y-auto p-6">
        {selected ? <MessageDetail message={selected} /> : (
          <EmptyState title="Select a message" body="Pick one from the list to read it." />
        )}
      </div>
    </div>
  );
}

function FilterChip({
  active, onClick, children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'rounded-full px-4 py-1.5 text-xs uppercase tracking-[0.18em] transition ' +
        (active
          ? 'border border-metal-rose bg-metal-rose/15 text-metal-rose'
          : 'border border-metal-deep/40 text-ink-muted hover:text-ink-primary')
      }
    >
      {children}
    </button>
  );
}

function MessageDetail({ message }: { message: MessageRow }) {
  const router = useRouter();
  const [marking, setMarking] = useState(false);

  const markRead = async () => {
    setMarking(true);
    try {
      const response = await fetch(`/api/messages/${message.id}`, { method: 'PATCH' });
      const result = await response.json().catch(() => ({})) as {
        success?: boolean;
        error?: string;
        code?: string;
      };
      if (!response.ok || result.success === false) {
        throw new Error(result.error ?? 'Update failed.');
      }
      router.refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setMarking(false);
    }
  };

  // Reply targets the client directly. The API already sets `replyTo:
  // clientEmail` on the agency notification, so this button matches that
  // behavior whether the admin clicks here or in their email client.
  const mailto = (() => {
    const subject = message.subject ? `Re: ${message.subject}` : 'Re: Your message';
    const body =
      `On ${formatDateTime(message.sentAt)}, ` +
      `${message.user.firstName} ${message.user.lastName} wrote:\n\n` +
      message.body
        .split('\n')
        .map((l) => `> ${l}`)
        .join('\n');
    const params = new URLSearchParams({ subject, body });
    return `mailto:${message.user.email}?${params.toString()}`;
  })();

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge tone={PLAN_TONE[message.tenant.subscriptionTier]}>Premium</Badge>
            <Badge tone={message.status === 'unread' ? 'unread' : 'read'}>
              {message.status}
            </Badge>
            <Badge
              tone={message.emailDeliveryStatus === 'sent'
                ? 'active'
                : message.emailDeliveryStatus === 'failed'
                  ? 'past_due'
                  : 'incomplete'}
            >
              Email {message.emailDeliveryStatus}
            </Badge>
          </div>
          <h2 className="font-display text-2xl font-bold text-ink-primary">
            {message.subject ?? 'No subject'}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            From {message.user.firstName} {message.user.lastName} ·{' '}
            <a href={`mailto:${message.user.email}`} className="hover:underline">
              {message.user.email}
            </a>{' '}
            ·{' '}
            <Link href={`/clients/${message.tenant.id}`} className="text-metal-rose hover:underline">
              {message.tenant.businessName}
            </Link>
          </p>
          <p className="mt-1 text-xs text-ink-subtle">{formatDateTime(message.sentAt)}</p>
        </div>
      </header>

      <div className="rounded-lg border border-metal-deep/30 bg-bg-inset p-5 text-sm leading-relaxed text-ink-primary">
        <p className="whitespace-pre-wrap">{message.body}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <a
          href={mailto}
          className="btn-metal rounded-lg px-5 py-2.5 text-xs uppercase tracking-[0.18em]"
        >
          Reply via email
        </a>
        {message.status !== 'read' && (
          <button
            type="button"
            onClick={markRead}
            disabled={marking}
            className="btn-ghost rounded-lg px-5 py-2.5 text-xs uppercase tracking-[0.18em]"
          >
            {marking ? 'Marking…' : 'Mark as read'}
          </button>
        )}
        <Link
          href={`/clients/${message.tenant.id}`}
          className="btn-ghost rounded-lg px-5 py-2.5 text-xs uppercase tracking-[0.18em]"
        >
          View client →
        </Link>
      </div>
    </div>
  );
}
