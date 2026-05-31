import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  trend?: { direction: 'up' | 'down'; value: string };
  /** Highlights the card with a rose-gold frame — use sparingly. */
  emphasis?: boolean;
}

export function StatCard({ label, value, hint, trend, emphasis }: StatCardProps) {
  return (
    <div
      className={
        'glass flex flex-col gap-2 p-6 shadow-card ' +
        (emphasis ? 'border-metal-rose/60 shadow-glow' : '')
      }
    >
      <p className="label">{label}</p>
      <p className="font-display text-3xl font-bold text-ink-primary">{value}</p>
      {(hint || trend) && (
        <div className="flex items-center justify-between">
          {hint && <p className="text-xs text-ink-muted">{hint}</p>}
          {trend && (
            <span
              className={
                'text-xs font-semibold ' +
                (trend.direction === 'up' ? 'text-status-success' : 'text-status-danger')
              }
            >
              {trend.direction === 'up' ? '↑' : '↓'} {trend.value}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
