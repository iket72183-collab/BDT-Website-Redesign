'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate, formatUSD } from '@/lib/format';

interface ClientRow {
  id: string;
  businessName: string;
  subscriptionTier: 'basic' | 'premium';
  subscriptionStatus: 'incomplete' | 'active' | 'trialing' | 'past_due' | 'cancelled';
  createdAt: string;
  mrr: number;
  planName: string;
  owner: { firstName: string; lastName: string; email: string; phone: string | null } | null;
}

interface Props {
  rows: ClientRow[];
  total: number;
  page: number;
  limit: number;
  /** Current query values — controlled inputs initialize from these. */
  search: string;
  plan: string;
  status: string;
  sort: 'joined' | 'mrr' | 'name';
  order: 'asc' | 'desc';
}

const STATUS_TONE: Record<ClientRow['subscriptionStatus'], BadgeTone> = {
  incomplete: 'incomplete',
  active: 'active',
  trialing: 'trialing',
  past_due: 'past_due',
  cancelled: 'cancelled',
};

/**
 * Interactive table — the rows themselves are server-fetched, but search,
 * filter, sort, and pagination all live in the URL so links + back/forward
 * navigation work as expected.
 */
export function ClientsTable(props: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(props.search);

  const update = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') params.delete(k);
      else params.set(k, v);
    }
    // Reset to page 1 whenever any filter / sort changes.
    if (!('page' in patch)) params.set('page', '1');
    router.push(`/clients?${params.toString()}`);
  };

  const onSort = (col: 'name' | 'joined' | 'mrr') => {
    const sameCol = props.sort === col;
    update({ sort: col, order: sameCol && props.order === 'asc' ? 'desc' : 'asc' });
  };

  const totalPages = Math.max(1, Math.ceil(props.total / props.limit));

  const csv = useMemo(() => buildCsv(props.rows), [props.rows]);
  const csvHref = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;

  return (
    <div className="space-y-4">
      {/* --- Filter bar -------------------------------------------------- */}
      <div className="glass flex flex-wrap items-center gap-3 p-4">
        <form
          onSubmit={(e) => { e.preventDefault(); update({ search: search.trim() || null }); }}
          className="min-w-[240px] flex-1"
        >
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search business name, slug, or owner email"
            className="w-full rounded-lg border border-metal-deep/40 bg-bg-inset px-4 py-2 text-sm text-ink-primary placeholder-ink-subtle focus:border-metal-rose focus:outline-none"
          />
        </form>

        <Select
          label="Plan"
          value={props.plan}
          onChange={(v) => update({ plan: v || null })}
          options={[
            { value: '', label: 'All plans' },
            { value: 'basic', label: 'Basic' },
            { value: 'premium', label: 'Premium' },
          ]}
        />

        <Select
          label="Status"
          value={props.status}
          onChange={(v) => update({ status: v || null })}
          options={[
            { value: '', label: 'All statuses' },
            { value: 'active', label: 'Active' },
            { value: 'trialing', label: 'Trialing' },
            { value: 'past_due', label: 'Past due' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
        />

        <a
          href={csvHref}
          download={`bdt-clients-${new Date().toISOString().slice(0, 10)}.csv`}
          className="btn-ghost rounded-lg px-4 py-2 text-xs uppercase tracking-[0.18em]"
        >
          Export CSV
        </a>
      </div>

      {/* --- Table ------------------------------------------------------- */}
      <div className="glass overflow-hidden p-0">
        {props.rows.length === 0 ? (
          <EmptyState
            title="No clients match these filters"
            body="Adjust the search or filters above, or clear them to see everyone."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-metal-deep/30 text-ink-muted">
              <tr>
                <Th onClick={() => onSort('name')} sorted={props.sort === 'name' ? props.order : undefined}>
                  Business
                </Th>
                <Th>Owner</Th>
                <Th>Plan</Th>
                <Th>Status</Th>
                <Th onClick={() => onSort('mrr')} sorted={props.sort === 'mrr' ? props.order : undefined}>
                  MRR
                </Th>
                <Th onClick={() => onSort('joined')} sorted={props.sort === 'joined' ? props.order : undefined}>
                  Joined
                </Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-metal-deep/20">
              {props.rows.map((c) => (
                <tr key={c.id} className="hover:bg-bg-raised/30">
                  <td className="px-4 py-3">
                    <Link href={`/clients/${c.id}`} className="font-medium text-ink-primary hover:text-metal-rose">
                      {c.businessName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {c.owner ? (
                      <div>
                        <div>{c.owner.firstName} {c.owner.lastName}</div>
                        <div className="text-xs text-ink-subtle">{c.owner.email}</div>
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={c.subscriptionTier}>{c.planName}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[c.subscriptionStatus]}>{c.subscriptionStatus}</Badge>
                  </td>
                  <td className="px-4 py-3 font-medium text-ink-primary">{formatUSD(c.mrr)}</td>
                  <td className="px-4 py-3 text-ink-muted">{formatDate(c.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/clients/${c.id}`} className="text-xs text-metal-rose hover:underline">
                      View →
                    </Link>
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
          <PagerBtn
            disabled={props.page <= 1}
            onClick={() => update({ page: String(props.page - 1) })}
          >
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

interface ThProps {
  children: React.ReactNode;
  onClick?: () => void;
  sorted?: 'asc' | 'desc';
  className?: string;
}

function Th({ children, onClick, sorted, className }: ThProps) {
  const arrow = sorted ? (sorted === 'asc' ? ' ↑' : ' ↓') : '';
  return (
    <th
      onClick={onClick}
      className={
        'px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] ' +
        (onClick ? 'cursor-pointer select-none hover:text-metal-rose ' : '') +
        (className ?? '')
      }
    >
      {children}{arrow}
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
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function PagerBtn({ disabled, onClick, children }: {
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

function buildCsv(rows: ClientRow[]): string {
  const header = [
    'Business Name', 'Owner Name', 'Email', 'Phone',
    'Plan', 'Status', 'MRR (USD/mo)', 'Joined',
  ].join(',');
  const lines = rows.map((c) => [
    escape(c.businessName),
    escape(c.owner ? `${c.owner.firstName} ${c.owner.lastName}` : ''),
    escape(c.owner?.email ?? ''),
    escape(c.owner?.phone ?? ''),
    c.planName,
    c.subscriptionStatus,
    c.mrr,
    new Date(c.createdAt).toISOString().slice(0, 10),
  ].join(','));
  return [header, ...lines].join('\n');
}

/**
 * CSV cell escape with two layers:
 *
 *   1. Formula injection guard. Excel / Google Sheets / Numbers interpret a
 *      cell starting with `=`, `+`, `-`, or `@` as a formula. A business
 *      named `=cmd|'/c calc'!A1` would execute on open. Prefix any such
 *      value with a literal apostrophe so the spreadsheet treats it as text.
 *
 *   2. RFC 4180 quoting. Anything containing a comma, quote, newline, or
 *      carriage return gets wrapped in double quotes with embedded quotes
 *      doubled up.
 */
function escape(s: string): string {
  const first = s.charAt(0);
  const sanitized =
    first === '=' || first === '+' || first === '-' || first === '@'
      ? `'${s}`
      : s;
  if (/[",\n\r]/.test(sanitized)) {
    return '"' + sanitized.replace(/"/g, '""') + '"';
  }
  return sanitized;
}
