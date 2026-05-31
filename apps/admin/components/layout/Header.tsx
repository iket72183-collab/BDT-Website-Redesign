'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  title: string;
  subtitle?: string;
  user?: { firstName: string; lastName: string; email: string } | null;
}

/**
 * Sign-out posts to the BFF /api/auth/logout, which:
 *   1. Fire-and-forget POSTs the backend /api/auth/logout (revokes the
 *      refresh-token row)
 *   2. Clears the httpOnly access cookie + readable user cookie
 *
 * The browser can't clear the httpOnly cookie itself — that's the whole
 * point of httpOnly. So we have to go through the server route.
 */
export function Header({ title, subtitle, user }: HeaderProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleSignOut = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Network failure → still bounce the user to /login. Middleware will
      // notice the cookie's gone (or expired) and gate them out anyway.
    }
    router.replace('/login');
    router.refresh();
  };

  const initials = user
    ? (user.firstName.charAt(0) + user.lastName.charAt(0)).toUpperCase()
    : '—';

  return (
    <header className="flex items-center justify-between border-b border-metal-deep/20 px-8 py-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink-primary">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        {user && (
          <div className="text-right">
            <p className="text-sm font-medium text-ink-primary">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-ink-subtle">{user.email}</p>
          </div>
        )}
        <div
          aria-hidden
          className="flex h-10 w-10 items-center justify-center rounded-full bg-metal-rose/15 text-sm font-semibold text-metal-rose"
        >
          {initials}
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={busy}
          className="btn-ghost rounded-lg px-4 py-2 text-xs uppercase tracking-[0.18em] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </header>
  );
}
