'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate } from '@/lib/format';

type RequestType =
  | 'website_update'
  | 'social_media'
  | 'general'
  | 'file_upload'
  | 'ai_creative'
  | 'report_request'
  | 'ai_consultation';
type RequestStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface RequestRow {
  id: string;
  type: RequestType;
  title: string;
  description: string;
  status: RequestStatus;
  attachments: { name: string; size: number; path: string }[];
  /** True when submitted as a paid $25 over-limit add-on (invoice separately). */
  addOn: boolean;
  createdAt: string;
  tenant: { id: string; businessName: string; subscriptionTier: 'premium' } | null;
}

interface Props {
  rows: RequestRow[];
  total: number;
  page: number;
  limit: number;
  /** Current query values — controlled inputs initialize from these. */
  search: string;
  type: string;
  status: string;
}

const TYPE_LABEL: Record<RequestType, string> = {
  website_update: 'Website Update',
  social_media: 'Social Media',
  general: 'General',
  file_upload: 'File Upload',
  ai_creative: 'AI Creative',
  report_request: 'Monthly Report',
  ai_consultation: 'AI Consultation',
};

// Map request status to an existing BadgeTone (no new tones introduced).
const STATUS_TONE: Record<RequestStatus, BadgeTone> = {
  pending: 'past_due', // amber
  in_progress: 'trialing', // rose-gold
  completed: 'active', // green
  cancelled: 'cancelled', // muted
};

const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_OPTIONS: RequestStatus[] = ['pending', 'in_progress', 'completed', 'cancelled'];

/**
 * Interactive table — rows are server-fetched, but search/filter/pagination
 * live in the URL (mirrors ClientsTable). The Actions column changes a
 * request's status via the /api/admin/requests/[id] route handler, then
 * refreshes the server data.
 */
export function RequestsTable(props: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(props.search);

  const update = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') params.delete(k);
      else params.set(k, v);
    }
    // Reset to page 1 whenever any filter changes.
    if (!('page' in patch)) params.set('page', '1');
    router.push(`/requests?${params.toString()}`);
  };

  const totalPages = Math.max(1, Math.ceil(props.total / props.limit));

  return (
    <div className="space-y-4">
      {/* --- Filter bar -------------------------------------------------- */}
      <div className="glass flex flex-wrap items-center gap-3 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            update({ search: search.trim() || null });
          }}
          className="min-w-[240px] flex-1"
        >
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by business name"
            className="w-full rounded-lg border border-metal-deep/40 bg-bg-inset px-4 py-2 text-sm text-ink-primary placeholder-ink-subtle focus:border-metal-rose focus:outline-none"
          />
        </form>

        <Select
          label="Status"
          value={props.status}
          onChange={(v) => update({ status: v || null })}
          options={[
            { value: '', label: 'All statuses' },
            { value: 'pending', label: 'Pending' },
            { value: 'in_progress', label: 'In Progress' },
            { value: 'completed', label: 'Completed' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
        />

        <Select
          label="Type"
          value={props.type}
          onChange={(v) => update({ type: v || null })}
          options={[
            { value: '', label: 'All types' },
            { value: 'website_update', label: 'Website' },
            { value: 'social_media', label: 'Social' },
            { value: 'ai_creative', label: 'AI Creative' },
            { value: 'report_request', label: 'Monthly Report' },
            { value: 'ai_consultation', label: 'AI Consultation' },
            { value: 'general', label: 'General' },
            { value: 'file_upload', label: 'File Upload' },
          ]}
        />
      </div>

      {/* --- Table ------------------------------------------------------- */}
      <div className="glass overflow-hidden p-0">
        {props.rows.length === 0 ? (
          <EmptyState
            title="No requests match these filters"
            body="Adjust the search or filters above, or clear them to see everything."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-metal-deep/30 text-ink-muted">
              <tr>
                <Th>Business</Th>
                <Th>Plan</Th>
                <Th>Type</Th>
                <Th>Billing</Th>
                <Th>Title</Th>
                <Th>Status</Th>
                <Th>Submitted</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-metal-deep/20">
              {props.rows.map((r) => (
                <tr key={r.id} className="hover:bg-bg-raised/30">
                  <td className="px-4 py-3 font-medium text-ink-primary">
                    {r.tenant?.businessName ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    {r.tenant ? (
                      <Badge tone={r.tenant.subscriptionTier}>Premium</Badge>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{TYPE_LABEL[r.type]}</td>
                  <td className="px-4 py-3">
                    {r.type === 'ai_consultation' ? (
                      // Standalone one-time service. Stripe not wired yet — this
                      // flags the $500 charge BDT collects out of band.
                      <Badge tone="addon">$500 one-time</Badge>
                    ) : r.addOn ? (
                      <Badge tone="addon">$25 Add-on</Badge>
                    ) : (
                      <span className="text-ink-subtle">In plan</span>
                    )}
                  </td>
                  <td className="max-w-[280px] truncate px-4 py-3 text-ink-primary" title={r.title}>
                    {r.title}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{formatDate(r.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <StatusSelect id={r.id} status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* --- Pagination -------------------------------------------------- */}
      <div className="flex items-center justify-between text-sm text-ink-muted">
        <p>
          Showing {(props.page - 1) * props.limit + 1}–
          {Math.min(props.page * props.limit, props.total)} of {props.total}
        </p>
        <div className="flex gap-2">
          <PagerBtn disabled={props.page <= 1} onClick={() => update({ page: String(props.page - 1) })}>
            ← Prev
          </PagerBtn>
          <span className="px-3 py-2 text-ink-muted">
            Page {props.page} of {totalPages}
          </span>
          <PagerBtn
            disabled={props.page >= totalPages}
            onClick={() => update({ page: String(props.page + 1) })}
          >
            Next →
          </PagerBtn>
        </div>
      </div>
    </div>
  );
}

/** Inline status changer — PATCHes via the route handler, then refreshes. */
function StatusSelect({ id, status }: { id: string; status: RequestStatus }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  const onChange = async (next: RequestStatus) => {
    if (next === status) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/requests/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  };

  return (
    <select
      value={status}
      disabled={saving || pending}
      onChange={(e) => onChange(e.target.value as RequestStatus)}
      className="rounded-lg border border-metal-deep/40 bg-bg-inset px-3 py-1.5 text-xs text-ink-primary focus:border-metal-rose focus:outline-none disabled:opacity-50"
    >
      {STATUS_OPTIONS.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={
        'px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] ' + (className ?? '')
      }
    >
      {children}
    </th>
  );
}

interface SelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}

function Select({ label, value, onChange, options }: SelectProps) {
  return (
    <label className="flex items-center gap-2 text-xs text-ink-muted">
      <span className="uppercase tracking-[0.18em]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-metal-deep/40 bg-bg-inset px-3 py-2 text-sm text-ink-primary focus:border-metal-rose focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PagerBtn({
  disabled,
  onClick,
  children,
}: {
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="btn-ghost rounded-lg px-3 py-2 text-xs uppercase tracking-[0.18em] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
