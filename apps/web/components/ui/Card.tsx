import { type HTMLAttributes } from 'react';
import { cn } from './cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  // `hover` lifts the card + adds a gold ring on pointer/keyboard focus.
  hover?: boolean;
  // `framed` adds the etched-gold inset border (used on premium tiers).
  framed?: boolean;
}

export function Card({ hover = false, framed = false, className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'glass rounded-2xl p-5 sm:p-8 shadow-card transition-all duration-300 ease-[var(--bdt-ease-base)]',
        hover &&
          'hover:-translate-y-1 hover:shadow-card-hover hover:border-metal-rose/40 ' +
            'focus-within:-translate-y-1 focus-within:shadow-card-hover',
        framed && 'metal-frame',
        className,
      )}
      {...rest}
    />
  );
}

export function CardEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-body text-caption uppercase tracking-label text-metal-rose">
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-display text-2xl text-ink-primary mt-3 sm:text-display-md">{children}</h3>
  );
}

export function CardBody({ children }: { children: React.ReactNode }) {
  return <p className="font-body text-body-sm leading-relaxed text-ink-muted mt-3 sm:text-body-md">{children}</p>;
}
