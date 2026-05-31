import Link from 'next/link';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

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
        <Badge tone="metal" className="animate-fade-up">
          <span className="size-1.5 rounded-full bg-metal-rose shadow-glow" />
          <span className="hidden xs:inline">By BDT Talent Group · Agency on retainer</span>
          <span className="xs:hidden">By BDT Talent Group</span>
        </Badge>

        <h1
          className="mt-5 font-display font-bold leading-[1.03] animate-fade-up
                     text-[2.18rem] xs:mt-6 xs:text-[2.5rem] sm:mt-8 sm:text-display-xl lg:text-display-2xl"
          style={{ animationDelay: '80ms' }}
        >
          <span className="text-ink-primary">Your online presence,</span>
          <br />
          <span className="text-metal-shimmer">professionally delivered.</span>
        </h1>

        <p
          className="mx-auto mt-4 max-w-2xl font-body text-body-sm leading-relaxed text-ink-muted animate-fade-up xs:mt-5 xs:text-body-md sm:mt-8 sm:text-body-lg"
          style={{ animationDelay: '160ms' }}
        >
          <span className="xs:hidden">
            Websites, social, and support managed by BDT Talent Group in one private client app.
          </span>
          <span className="hidden xs:inline">
            BDT Talent Group designs, maintains, and promotes your business online — and
            gives you a beautifully designed app to see every deliverable and message the
            team. One retainer. One app. No agency chaos.
          </span>
        </p>

        <div
          className="mt-5 w-full max-w-2xl rounded-2xl border border-metal-border/35 bg-bg-surface/55 px-4 py-3 text-left shadow-card backdrop-blur animate-fade-up xs:mt-6 xs:px-5 xs:py-4 sm:px-6"
          style={{ animationDelay: '220ms' }}
        >
          <div className="font-body text-caption uppercase tracking-label text-metal-rose">
            In progress
          </div>
          <p className="mt-2 font-body text-body-sm leading-relaxed text-ink-muted sm:text-body-md">
            <span className="xs:hidden">
              Stripe checkout is being set up. Preview the service now; paid plans open when billing is ready.
            </span>
            <span className="hidden xs:inline">
              BDT Connect is being prepared for client onboarding while Stripe payments
              and subscription checkout are set up. You can preview the service now;
              paid plans will open once billing is ready.
            </span>
          </p>
        </div>

        {/* CTAs: full-width on mobile, side-by-side from sm up. */}
        <div
          className="mt-6 flex w-full max-w-md flex-col items-stretch gap-3 sm:mt-12 sm:max-w-none sm:flex-row sm:items-center sm:justify-center sm:gap-4 animate-fade-up"
          style={{ animationDelay: '300ms' }}
        >
          <Link href="#plans" className="block w-full sm:inline-block sm:w-auto">
            <Button asAnchor size="lg" variant="primary" className="w-full sm:w-auto">
              See Plans
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
          style={{ animationDelay: '380ms' }}
        >
          14-day free trial · Cancel anytime · No long-term contract
        </p>
      </div>

      {/* Subtle gold divider line */}
      <div className="relative mx-auto h-px w-full max-w-7xl bg-gradient-to-r from-transparent via-metal-border/60 to-transparent" />
    </section>
  );
}
