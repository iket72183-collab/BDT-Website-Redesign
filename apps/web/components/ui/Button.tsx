import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ForwardedRef,
  type HTMLAttributes,
} from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'ghost' | 'text';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends HTMLAttributes<HTMLElement> {
  variant?: Variant;
  size?: Size;
  asAnchor?: boolean; // render button chrome without nesting a button in a link
  disabled?: boolean;
  type?: ButtonHTMLAttributes<HTMLButtonElement>['type'];
}

const base =
  'group relative inline-flex items-center justify-center font-body font-medium tracking-wide ' +
  'transition-[transform,box-shadow,background-position] duration-300 ease-[var(--bdt-ease-base)] ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-metal-rose/60 ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

const sizes: Record<Size, string> = {
  sm: 'px-4 py-2 text-sm rounded-md',
  md: 'px-6 py-3 text-base rounded-lg',
  lg: 'px-8 py-4 text-base rounded-lg uppercase tracking-label',
};

// Primary: metallic shimmering fill. Dark text on metal. Subtle lift on hover.
const primary =
  'text-ink-onMetal bg-metal-shimmer bg-shimmer animate-shimmer ' +
  'shadow-[0_8px_24px_rgba(201,168,130,0.18)] ' +
  'hover:shadow-glow-strong hover:-translate-y-px ' +
  'active:translate-y-0 active:shadow-glow';

// Ghost: transparent with a thin gold border that glows on hover.
const ghost =
  'text-metal-rose bg-transparent metal-frame ' +
  'hover:text-ink-primary hover:shadow-glow hover:bg-metal-rose/[0.06]';

// Text: bare link styled — underline appears as an animated metal bar.
const text =
  'text-ink-muted hover:text-ink-primary px-2 py-1 rounded ' +
  'after:content-[""] after:absolute after:left-2 after:right-2 after:bottom-0 ' +
  'after:h-px after:bg-metal-flat after:scale-x-0 after:origin-left ' +
  'after:transition-transform after:duration-300 after:ease-[var(--bdt-ease-base)] ' +
  'hover:after:scale-x-100';

const variants: Record<Variant, string> = { primary, ghost, text };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className, asAnchor, disabled, type, ...rest },
  ref,
) {
  const classes = cn(base, sizes[size], variants[variant], className);

  if (asAnchor) {
    return (
      <span
        ref={ref as ForwardedRef<HTMLSpanElement>}
        aria-disabled={disabled || undefined}
        className={classes}
        {...rest}
      />
    );
  }

  return (
    <button
      ref={ref as ForwardedRef<HTMLButtonElement>}
      className={classes}
      disabled={disabled}
      type={type ?? 'button'}
      {...rest}
    />
  );
});
