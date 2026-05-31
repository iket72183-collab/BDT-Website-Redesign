'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface LoginApiBody {
  success: boolean;
  data?: { user: { role: string } };
  error?: string;
  code?: string;
}

/**
 * Admin sign-in. Posts to the Next.js BFF (`/api/auth/login`), which forwards
 * to the backend and sets the access-token cookie httpOnly. We never see the
 * token in the browser — XSS can't read it.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg-base" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const nextPath = useSearchParams().get('next') ?? '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const body = (await res.json().catch(() => ({}))) as LoginApiBody;

      if (!res.ok || !body.success) {
        // The BFF route surfaces a friendly message for role mismatches.
        const message =
          body.code === 'role_not_permitted'
            ? 'This account is not authorized for the admin panel.'
            : body.error ?? 'Sign-in failed.';
        setError(message);
        return;
      }

      // Cookie is already set by the Route Handler; just bounce into the app.
      router.replace(nextPath);
    } catch {
      setError('Sign-in failed. Check your network and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="glass w-full max-w-md p-10 shadow-card">
        <div className="mb-8 text-center">
          <p className="label">BDT Connect</p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">Admin sign-in</h1>
          <p className="mt-2 text-sm text-ink-muted">
            For BDT Talent Group team members only.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Field
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={setEmail}
            required
          />
          <Field
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
            required
          />

          {error && (
            <p className="rounded-md border border-status-danger/40 bg-status-danger/10 px-3 py-2 text-sm text-ink-primary">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !email || !password}
            className="btn-metal h-12 w-full rounded-lg text-sm uppercase tracking-[0.18em]"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  type: 'email' | 'password' | 'text';
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
}

function Field({ label, type, value, onChange, autoComplete, required }: FieldProps) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        className="mt-2 block w-full rounded-lg border border-metal-deep/60 bg-bg-inset px-4 py-3 text-ink-primary placeholder-ink-subtle outline-none transition focus:border-metal-rose focus:shadow-glow"
      />
    </label>
  );
}
