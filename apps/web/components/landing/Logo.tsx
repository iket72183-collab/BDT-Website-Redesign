import { cn } from '../ui/cn';

interface LogoProps {
  // 'mark' = wordmark only (for nav). 'plaque' = framed BDT/CONNECT lockup
  // mirroring the brushed-metal logo plaque used on the brand asset.
  variant?: 'mark' | 'plaque';
  className?: string;
}

/**
 * Wordmark rendered in CSS so the landing page works before the official
 * brand asset is dropped in. Once a PNG/SVG of the plaque lives at
 * /apps/web/public/brand/bdt-connect-plaque.png, swap to <Image /> in
 * the consumer (Hero) — this component remains as the typographic fallback.
 */
export function Logo({ variant = 'mark', className }: LogoProps) {
  if (variant === 'mark') {
    return (
      <div className={cn('inline-flex flex-col items-start leading-none', className)}>
        <span className="font-display text-2xl font-bold tracking-tight text-metal-shimmer">
          BDT
        </span>
        <span className="font-display text-[0.7rem] font-medium uppercase tracking-[0.4em] text-metal">
          Connect
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative mx-auto inline-block px-12 py-10 sm:px-20 sm:py-14',
        'bg-[radial-gradient(ellipse_at_center,#1a1a1a_0%,#0a0a0a_100%)]',
        'metal-frame rounded-md',
        className,
      )}
    >
      {/* Thin inset gold frame to evoke the plaque border on the brand asset. */}
      <div className="pointer-events-none absolute inset-2 rounded-sm border border-metal-border/50" />
      <div className="relative text-center">
        <div className="font-display text-6xl sm:text-8xl font-bold tracking-tight text-metal-shimmer">
          BDT
        </div>
        <div className="mt-3 font-display text-2xl sm:text-4xl uppercase tracking-[0.35em] text-metal">
          Connect
        </div>
        <div className="mt-6 font-display italic text-xs sm:text-sm uppercase tracking-[0.25em] text-ink-muted">
          Subset of BDT Talent Group
        </div>
      </div>
    </div>
  );
}
