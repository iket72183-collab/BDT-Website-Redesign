import Link from 'next/link';
import { Button } from '../ui/Button';

export function Hero() {
  return (
    <section
      className="relative isolate flex min-h-[100svh] flex-col overflow-hidden pt-20 sm:pt-24"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 4.5rem)' }}
    >
      {/* Background atmospherics: two soft rose-gold pools + a vignette. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 20% 10%, rgba(201,168,130,0.16), transparent 60%), ' +
            'radial-gradient(ellipse 50% 40% at 80% 80%, rgba(201,168,130,0.10), transparent 60%)',
        }}
      />
      {/* Animated diagonal sheen that slowly drifts across the hero. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(115deg, transparent 40%, rgba(232,212,168,0.5) 50%, transparent 60%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 12s linear infinite',
        }}
      />

      {/* Hero content. Padding is tighter on mobile so CTAs sit above the fold. */}
      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-5 pb-12 pt-6 text-center xs:pb-16 xs:pt-8 sm:px-10 sm:pb-24 sm:pt-12">
        <h1
          className="font-display font-bold leading-[0.98] animate-fade-up
                     text-[2.5rem] xs:text-[2.9rem] sm:text-display-xl lg:text-display-2xl"
          style={{ animationDelay: '80ms' }}
        >
          <span className="block text-ink-primary">Your entire online presence.</span>
          <span className="mt-3 block text-[3rem] leading-none text-metal-shimmer xs:text-[3.45rem] sm:mt-4 sm:text-display-xl lg:text-display-2xl">
            $100/month.
          </span>
        </h1>

        <p
          className="mx-auto mt-5 max-w-3xl font-body text-[1.04rem] leading-[1.55] text-ink-muted animate-fade-up xs:mt-6 xs:text-[1.16rem] sm:mt-8 sm:text-body-lg"
          style={{ animationDelay: '160ms' }}
        >
          A monthly digital support service for small businesses that need social media help,
          website updates, creative assets, and basic performance reporting without hiring a full
          marketing team.
        </p>

        {/* CTAs: full-width on mobile, side-by-side from sm up. */}
        <div
          className="mt-8 flex w-full max-w-md flex-col items-stretch gap-3 sm:mt-12 sm:max-w-none sm:flex-row sm:items-center sm:justify-center sm:gap-4 animate-fade-up"
          style={{ animationDelay: '220ms' }}
        >
          <Link href="#plans" className="block w-full sm:inline-block sm:w-auto">
            <Button asAnchor size="lg" variant="primary" className="w-full sm:w-auto">
              Get Started
            </Button>
          </Link>
          <Link href="#how" className="block w-full sm:inline-block sm:w-auto">
            <Button asAnchor size="lg" variant="ghost" className="w-full sm:w-auto">
              How It Works
            </Button>
          </Link>
        </div>

        <p
          className="mt-5 max-w-xs font-body text-caption uppercase tracking-label text-ink-subtle animate-fade-up xs:mt-6 sm:mt-8 sm:max-w-none"
          style={{ animationDelay: '300ms' }}
        >
          Service starts on signup · Cancel anytime · No long-term contract
        </p>
      </div>

      {/* Subtle gold divider line */}
      <div className="relative mx-auto h-px w-full max-w-7xl bg-gradient-to-r from-transparent via-metal-border/60 to-transparent" />
    </section>
  );
}
