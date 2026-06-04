'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type SubscriptionStatus = 'incomplete' | 'active' | 'trialing' | 'past_due' | 'cancelled';

interface ClientEditorProps {
  clientId: string;
  initial: {
    notes: string | null;
    isActive: boolean;
    businessName: string;
    subscriptionStatus: SubscriptionStatus;
  };
}

/**
 * Houses the admin-only mutable bits of the client detail page:
 *   - internal notes (PATCH /api/admin/clients/:id { notes })
 *   - suspend toggle (PATCH /api/admin/clients/:id { isActive: false })
 *   - delete with type-the-name confirmation (also via PATCH { isActive:false })
 *
 * Hard delete is intentionally not exposed — preserving the row keeps audit
 * trails (subscription_events, messages, etc.) referentially intact.
 */
export function ClientEditor({ clientId, initial }: ClientEditorProps) {
  const router = useRouter();
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSavedAt, setNotesSavedAt] = useState<Date | null>(null);
  const [notesError, setNotesError] = useState<string | null>(null);

  const [isActive, setIsActive] = useState(initial.isActive);

  const [status, setStatus] = useState<SubscriptionStatus>(initial.subscriptionStatus);
  const [activating, setActivating] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const patchClient = async (body: {
    notes?: string | null;
    isActive?: boolean;
    subscriptionStatus?: SubscriptionStatus;
  }) => {
    const response = await fetch(`/api/clients/${clientId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({})) as {
      success?: boolean;
      error?: string;
      code?: string;
    };
    if (!response.ok || result.success === false) {
      throw new Error(result.error ?? 'Update failed.');
    }
  };

  const saveNotes = async () => {
    setNotesSaving(true);
    setNotesError(null);
    try {
      await patchClient({ notes: notes.trim() || null });
      setNotesSavedAt(new Date());
      router.refresh();
    } catch (err) {
      setNotesError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setNotesSaving(false);
    }
  };

  const toggleSuspend = async () => {
    const next = !isActive;
    const ok = window.confirm(
      next ? 'Reactivate this account?' : 'Suspend this account? The client will lose access immediately.',
    );
    if (!ok) return;
    setIsActive(next); // optimistic
    try {
      await patchClient({ isActive: next });
      router.refresh();
    } catch (err) {
      setIsActive(!next); // rollback
      window.alert(err instanceof Error ? err.message : 'Update failed.');
    }
  };

  const activateAccount = async () => {
    const ok = window.confirm(
      'Manually activate this account? Use this only when Stripe shows a completed payment ' +
        'but the status is stuck on “incomplete” (e.g. the webhook failed). This grants the ' +
        'client full app access.',
    );
    if (!ok) return;
    setActivating(true);
    try {
      await patchClient({ subscriptionStatus: 'trialing' });
      setStatus('trialing');
      router.refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Activation failed.');
    } finally {
      setActivating(false);
    }
  };

  const confirmDelete = async () => {
    if (deleteConfirm !== initial.businessName) return;
    setDeleting(true);
    try {
      await patchClient({ isActive: false });
      router.push('/clients');
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Delete failed.');
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Notes editor */}
      <div>
        <label className="label">Internal Notes</label>
        <p className="mt-1 text-xs text-ink-subtle">
          Never visible to the client. Use for context BDT needs about this account.
        </p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          className="mt-2 w-full rounded-lg border border-metal-deep/40 bg-bg-inset p-3 text-sm text-ink-primary placeholder-ink-subtle focus:border-metal-rose focus:outline-none"
          placeholder="High-touch client. Prefers async updates. Has a launch deadline in June."
        />
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-ink-muted">
            {notesError
              ? <span className="text-status-danger">{notesError}</span>
              : notesSavedAt
                ? `Saved ${notesSavedAt.toLocaleTimeString()}`
                : ' '}
          </p>
          <button
            type="button"
            onClick={saveNotes}
            disabled={notesSaving || notes === (initial.notes ?? '')}
            className="btn-metal rounded-lg px-4 py-2 text-xs uppercase tracking-[0.18em]"
          >
            {notesSaving ? 'Saving…' : 'Save notes'}
          </button>
        </div>
      </div>

      {/* Manual activation — escape hatch for a failed Stripe webhook. Only
          shown while the tenant is stuck pre-payment; once active/trialing it
          disappears. */}
      {status === 'incomplete' && (
        <div className="rounded-xl border border-status-warning/30 bg-status-warning/5 p-5">
          <h3 className="font-display text-lg font-semibold text-ink-primary">
            Payment setup incomplete
          </h3>
          <p className="mt-1 text-xs text-ink-muted">
            This client registered but their subscription never activated, so they cannot access
            the app. If Stripe shows a completed payment, the activation webhook may have failed —
            manually activate to restore access.
          </p>
          <button
            type="button"
            onClick={activateAccount}
            disabled={activating}
            className="btn-metal mt-4 rounded-lg px-4 py-2 text-xs uppercase tracking-[0.18em] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {activating ? 'Activating…' : 'Activate account'}
          </button>
        </div>
      )}

      {/* Danger zone */}
      <div className="rounded-xl border border-status-danger/30 bg-status-danger/5 p-5">
        <h3 className="font-display text-lg font-semibold text-ink-primary">Danger zone</h3>
        <p className="mt-1 text-xs text-ink-muted">
          {isActive
            ? 'Suspending blocks login + revokes app access immediately. Reversible.'
            : 'This account is currently suspended. Reactivate to restore access.'}
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={toggleSuspend}
            className="btn-ghost rounded-lg px-4 py-2 text-xs uppercase tracking-[0.18em]"
          >
            {isActive ? 'Suspend account' : 'Reactivate account'}
          </button>
          <button
            type="button"
            onClick={() => setDeleteOpen((v) => !v)}
            className="rounded-lg border border-status-danger/60 px-4 py-2 text-xs uppercase tracking-[0.18em] text-status-danger hover:bg-status-danger/10"
          >
            Delete account
          </button>
        </div>

        {deleteOpen && (
          <div className="mt-4 rounded-lg border border-status-danger/40 bg-bg-inset p-4">
            <p className="text-sm text-ink-primary">
              Type <span className="font-semibold text-metal-rose">{initial.businessName}</span> to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              className="mt-3 w-full rounded-lg border border-metal-deep/40 bg-bg-base px-3 py-2 text-sm text-ink-primary focus:border-status-danger focus:outline-none"
              placeholder={initial.businessName}
            />
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleteConfirm !== initial.businessName || deleting}
              className="mt-3 rounded-lg bg-status-danger px-4 py-2 text-xs uppercase tracking-[0.18em] text-ink-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              {deleting ? 'Working…' : 'Confirm delete'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
