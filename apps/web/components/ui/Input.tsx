import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from './cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, invalid, className, id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name ?? undefined;
  return (
    <label className="block w-full" htmlFor={inputId}>
      {label && (
        <span className="font-body text-caption uppercase tracking-label text-ink-muted">
          {label}
        </span>
      )}
      <input
        ref={ref}
        id={inputId}
        className={cn(
          'mt-2 block w-full rounded-lg bg-bg-inset px-4 py-3 font-body text-body-md',
          'text-ink-primary placeholder:text-ink-subtle',
          'border border-metal-border/40',
          'transition-[box-shadow,border-color] duration-200',
          'focus:outline-none focus:border-metal-rose/70 focus:shadow-glow',
          invalid && 'border-[color:var(--bdt-status-danger)]/60 focus:shadow-none',
          className,
        )}
        {...rest}
      />
      {hint && (
        <span className={cn('mt-2 block text-body-sm', invalid ? 'text-[color:var(--bdt-status-danger)]' : 'text-ink-subtle')}>
          {hint}
        </span>
      )}
    </label>
  );
});
