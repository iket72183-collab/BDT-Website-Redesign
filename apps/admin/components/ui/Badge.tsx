import type { ReactNode } from 'react';

export type BadgeTone =
  | 'incomplete'  // setup not finished
  | 'active'      // green-ish "all good"
  | 'trialing'    // gold "in trial"
  | 'past_due'    // warning
  | 'cancelled'   // muted
  | 'premium'     // rose-gold metal accent
  | 'basic'       // outlined neutral
  | 'unread'
  | 'read';

const TONES: Record<BadgeTone, string> = {
  incomplete:'border-ink-subtle/40 bg-ink-subtle/10 text-ink-muted',
  active:    'border-status-success/40 bg-status-success/15 text-status-success',
  trialing:  'border-metal-rose/50 bg-metal-rose/10 text-metal-rose',
  past_due:  'border-status-warning/40 bg-status-warning/15 text-status-warning',
  cancelled: 'border-ink-subtle/40 bg-ink-subtle/10 text-ink-muted',
  premium:   'border-metal-border/60 bg-metal-rose/15 text-metal-champagne',
  basic:     'border-metal-border/40 bg-bg-raised text-ink-muted',
  unread:    'border-metal-rose/50 bg-metal-rose/10 text-metal-rose',
  read:      'border-ink-subtle/30 bg-bg-raised text-ink-muted',
};

interface BadgeProps {
  tone: BadgeTone;
  children: ReactNode;
}

export function Badge({ tone, children }: BadgeProps) {
  return (
    <span
      className={
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ' +
        TONES[tone]
      }
    >
      {children}
    </span>
  );
}
