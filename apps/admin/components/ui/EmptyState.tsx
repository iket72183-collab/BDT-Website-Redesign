import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  body?: string;
  action?: ReactNode;
}

export function EmptyState({ title, body, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <p className="font-display text-xl font-semibold text-ink-primary">{title}</p>
      {body && <p className="max-w-md text-sm text-ink-muted">{body}</p>}
      {action}
    </div>
  );
}
