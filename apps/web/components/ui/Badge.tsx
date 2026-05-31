import { type HTMLAttributes } from 'react';
import { cn } from './cn';

type Tone = 'metal' | 'muted' | 'success' | 'danger';

const tones: Record<Tone, string> = {
  metal:
    'text-metal-rose border-metal-border/60 bg-metal-rose/[0.08]',
  muted:
    'text-ink-muted border-ink-subtle/40 bg-ink-subtle/[0.06]',
  success:
    'text-[color:var(--bdt-status-success)] border-[color:var(--bdt-status-success)]/40 bg-[color:var(--bdt-status-success-soft)]',
  danger:
    'text-[color:var(--bdt-status-danger)] border-[color:var(--bdt-status-danger)]/40 bg-[color:var(--bdt-status-danger-soft)]',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ tone = 'metal', className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1',
        'font-body text-caption uppercase tracking-label',
        tones[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
