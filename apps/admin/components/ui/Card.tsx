import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  action?: ReactNode;
  /** Tighten the inner padding — for tabular cards where the rows handle it. */
  dense?: boolean;
  /** Apply the metallic frame — use for emphasis. */
  framed?: boolean;
  children: ReactNode;
}

export function Card({ title, action, dense, framed, children }: CardProps) {
  return (
    <section
      className={
        'glass shadow-card ' +
        (framed ? 'shadow-frame ' : '') +
        (dense ? 'p-2' : 'p-6')
      }
    >
      {(title || action) && (
        <header className={'mb-4 flex items-center justify-between ' + (dense ? 'px-4 pt-4' : '')}>
          {title && (
            <h2 className="font-display text-xl font-semibold text-ink-primary">{title}</h2>
          )}
          {action && <div>{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
