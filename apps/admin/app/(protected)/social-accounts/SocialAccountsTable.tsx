'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate } from '@/lib/format';

type SocialPlatform =
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'google_business'
  | 'x_twitter'
  | 'youtube'
  | 'linkedin'
  | 'other';
type AccessMethod = 'delegated' | 'credentials' | 'create_for_me';
type AccountStatus = 'pending' | 'access_granted' | 'active' | 'revoked' | 'needs_attention';

export interface SocialAccountRow {
  id: string;
  platform: SocialPlatform;
  handle: string | null;
  accessMethod: AccessMethod;
  status: AccountStatus;
  secretUpdatedAt: string | null;
  createdAt: string;
  tenant: { id: string; businessName: string; subscriptionTier: 'premium' } | null;
}

interface Props {
  rows: SocialAccountRow[];
  total: number;
  page: number;
  limit: number;
  search: string;
  platform: string;
  status: string;
}

const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  google_business: 'Google Business',
  x_twitter: 'X / Twitter',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  other: 'Other',
};

const METHOD_LABEL: Record<AccessMethod, string> = {
  delegated: 'Delegated',
  credentials: 'Login',
  create_for_me: 'Create for me',
};

const STATUS_LABEL: Record<AccountStatus, string> = {
  pending: 'Pending',
  access_granted: 'Access Granted',
  active: 'Active',
  revoked: 'Revoked',
  needs_attention: 'Needs Attention',
};

const STATUS_TONE: Record<AccountStatus, BadgeTone> = {
  pending: 'past_due',
  access_granted: 'active',
  active: 'active',
  revoked: 'cancelled',
  needs_attention: 'trialing',
};

const STATUS_OPTIONS: AccountStatus[] = [
  'pending',
  'access_granted',
  'active',
  'revoked',
  'needs_attention',
];

export function SocialAccountsTable(props: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(props.search);
  const [reveal, setReveal] = useState<SocialAccountRow | null>(null);

  const update = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') params.delete(k);
      else params.set(k, v);
    }
    if (!('page' in patch)) params.set('page', '1');
    router.push(`/social-accounts?${params.toString()}`);
  };

  // Business-name search is applied client-side over the loaded page.
  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return props.rows;
    return props.rows.filter((r) => r.tenant?.businessName.toLowerCase().includes(q));
  }, [props.rows, search]);

  const totalPages = Math.max(1, Math.ceil(props.total / props.limit));

  return (
    <div className="space-y-4">
      {/* --- Filter bar --- */}
      <div className="glass flex flex-wrap items-center gap-3 p-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search business name (this page)"
          className="min-w-[240px] flex-1 rounded-lg border border-metal-deep/40 bg-bg-inset px-4 py-2 text-sm text-ink-primary placeholder-ink-subtle focus:border-metal-rose focus:outline-none"
        />
        <Select
          label="Platform"
          value={props.platform}
          onChange={(v) => update({ platform: v || null })}
          options={[
            { value: '', label: 'All platforms' },
            ...Object.entries(PLATFORM_LABEL).map(([value, label]) => ({ value, label })),
          ]}
        />
        <Select
          label="Status"
          value={props.status}
          onChange={(v) => update({ status: v || null })}
          options={[
            { value: '', label: 'All statuses' },
            ...STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
          ]}
        />
      </div>

      {/* --- Table --- */}
      <div className="glass overflow-hidden p-0">
        {visibleRows.length === 0 ? (
          <EmptyState
            title="No accounts match these filters"
            body="Adjust the search or filters above, or clear them to see everything."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-metal-deep/30 text-ink-muted">
              <tr>
                <Th>Business</Th>
                <Th>Plan</Th>
                <Th>Platform</Th>
                <Th>Handle</Th>
                <Th>Method</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-metal-deep/20">
              {visibleRows.map((r) => (
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
                  <td className="px-4 py-3 text-ink-primary">{PLATFORM_LABEL[r.platform]}</td>
                  <td className="px-4 py-3 text-ink-muted">{r.handle ?? '—'}</td>
                  <td className="px-4 py-3 text-ink-muted">{METHOD_LABEL[r.accessMethod]}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {r.secretUpdatedAt && (
                        <button
                          type="button"
                          onClick={() => setReveal(r)}
                          className="btn-ghost rounded-lg px-3 py-1.5 text-xs uppercase tracking-[0.18em]"
                        >
                          View Login
                        </button>
                      )}
                      <StatusSelect id={r.id} status={r.status} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* --- Pagination --- */}
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

      {reveal && <CredentialsModal account={reveal} onClose={() => setReveal(null)} />}
    </div>
  );
}

/** Decrypt + display a stored login. The fetch is audited server-side. */
function CredentialsModal({
  account,
  onClose,
}: {
  account: SocialAccountRow;
  onClose: () => void;
}) {
  const [creds, setCreds] = useState<{ username: string; password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/admin/social-accounts/${account.id}/credentials`, {
          cache: 'no-store',
        });
        const json = (await res.json()) as {
          data?: { username: string; password: string };
          error?: string;
        };
        if (!active) return;
        if (!res.ok || !json.data) setError(json.error ?? 'Could not load credentials.');
        else setCreds({ username: json.data.username, password: json.data.password });
      } catch {
        if (active) setError('Could not load credentials.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [account.id]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="glass w-full max-w-md space-y-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-ink-primary">
            {PLATFORM_LABEL[account.platform]} login
          </h2>
          <button onClick={onClose} className="text-ink-muted hover:text-ink-primary">
            ✕
          </button>
        </div>

        <div className="rounded-lg border border-status-warning/40 bg-status-warning/10 px-3 py-2 text-xs text-status-warning">
          This access is logged. Only open a client's login when you need it for active work.
        </div>

        {loading ? (
          <p className="text-sm text-ink-muted">Decrypting…</p>
        ) : error ? (
          <p className="text-sm text-status-warning">{error}</p>
        ) : creds ? (
          <div className="space-y-3">
            <Field label="Username" value={creds.username} />
            <Field label="Password" value={creds.password} secret hidden={!showPassword} />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="text-xs uppercase tracking-[0.18em] text-metal-rose hover:underline"
            >
              {showPassword ? 'Hide password' : 'Show password'}
            </button>
          </div>
        ) : null}

        <button
          onClick={onClose}
          className="btn-ghost w-full rounded-lg px-4 py-2 text-xs uppercase tracking-[0.18em]"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  secret,
  hidden,
}: {
  label: string;
  value: string;
  secret?: boolean;
  hidden?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — ignore */
    }
  };
  return (
    <div>
      <p className="label mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-lg bg-bg-inset px-3 py-2 text-sm text-ink-primary">
          {secret && hidden ? '••••••••••' : value}
        </code>
        <button
          type="button"
          onClick={copy}
          className="btn-ghost rounded-lg px-3 py-2 text-xs uppercase tracking-[0.18em]"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
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

function StatusSelect({ id, status }: { id: string; status: AccountStatus }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  const onChange = async (next: AccountStatus) => {
    if (next === status) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/social-accounts/${id}`, {
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
      onChange={(e) => onChange(e.target.value as AccountStatus)}
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
