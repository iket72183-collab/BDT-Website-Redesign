import Link from 'next/link';
import { Button } from '../ui/Button';

const heroSignals = [
  ['One retainer', 'Website, social, creative, reporting'],
  ['$100/month', 'Clear monthly Premium service'],
  ['Direct line', 'Message your BDT team anytime'],
];

export function Hero() {
  return (
    <section
      className="connect-hero-stage relative isolate flex min-h-[100svh] flex-col overflow-hidden pt-20 sm:pt-24"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 4.5rem)' }}
    >
      {/* Background atmospherics: two soft rose-gold pools + a vignette. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 20% 10%, rgba(201,168,130,0.16), transparent 60%), ' +
            'radial-gradient(ellipse 50% 40% at 80% 80%, rgba(201,168,130,0.10), transparent 60%), ' +
            'linear-gradient(180deg, rgba(10,10,10,0.08), rgba(10,10,10,0.7))',
        }}
      />
      {/* Subtle diagonal metal wash: static, so the hero feels composed. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(115deg, transparent 40%, rgba(232,212,168,0.5) 50%, transparent 60%)',
          backgroundSize: '200% 100%',
        }}
      />

      {/* Hero content. Editorial copy at left, client-service signal deck at right. */}
      <div className="relative z-10 mx-auto grid w-full max-w-7xl flex-1 items-center gap-10 px-5 pb-12 pt-7 xs:pb-16 sm:px-10 sm:pb-20 sm:pt-12 lg:grid-cols-[1.03fr_0.97fr] lg:gap-14 lg:pb-24">
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <h1
            className="max-w-3xl font-display font-bold leading-[0.96] animate-fade-up
                       text-[2.5rem] xs:text-[2.9rem] sm:text-display-xl lg:text-[4.75rem]"
            style={{ animationDelay: '80ms' }}
          >
            <span className="block text-ink-primary">Your entire online presence.</span>
            <span className="mt-3 block text-[3rem] leading-none text-metal-shimmer xs:text-[3.45rem] sm:mt-4 sm:text-display-xl lg:text-[5rem]">
              $100/month.
            </span>
          </h1>

          <p
            className="mt-5 max-w-2xl font-body text-[1.04rem] leading-[1.6] text-ink-muted animate-fade-up xs:mt-6 xs:text-[1.16rem] sm:mt-8 sm:text-body-lg"
            style={{ animationDelay: '160ms' }}
          >
            A monthly digital support service for small businesses that need social media help,
            website updates, creative assets, and basic performance reporting without hiring a full
            marketing team.
          </p>

          <div
            className="mt-8 flex w-full max-w-md flex-col items-stretch gap-3 sm:mt-10 sm:max-w-none sm:flex-row sm:items-center sm:gap-4 animate-fade-up"
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
            className="mt-5 max-w-xs font-body text-caption uppercase tracking-label text-ink-subtle animate-fade-up xs:mt-6 sm:mt-7 sm:max-w-none"
            style={{ animationDelay: '300ms' }}
          >
            Service starts on signup · Cancel anytime · No long-term contract
          </p>
        </div>

        <div
          aria-label="BDT Connect service highlights"
          className="connect-showcase relative hidden w-full rounded-2xl border border-metal-border/30 p-4 animate-fade-up sm:block lg:flex lg:min-h-[31rem] lg:items-end lg:rounded-[2rem] lg:p-6"
          style={{ animationDelay: '240ms' }}
        >
          <div aria-hidden className="absolute left-1/2 top-[15%] size-32 -translate-x-1/2 rounded-full border border-metal-rose/30 bg-metal-rose/[0.04] shadow-glow-strong" />
          <div aria-hidden className="absolute left-1/2 top-[24%] size-4 -translate-x-1/2 rounded-full bg-metal-rose shadow-glow-strong" />

          <div className="relative z-10 grid w-full gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {heroSignals.map(([label, detail]) => (
              <div
                key={label}
                className="connect-signal rounded-xl border border-metal-border/25 bg-bg-surface/75 px-5 py-4 text-left shadow-card backdrop-blur-xl transition-[border-color,background-color,box-shadow,transform] duration-300 ease-[var(--bdt-ease-base)] hover:-translate-y-0.5 hover:border-metal-rose/50 hover:bg-bg-raised/85 hover:shadow-glow"
              >
                <div className="font-display text-2xl text-ink-primary">{label}</div>
                <div className="mt-1 font-body text-caption uppercase tracking-label text-ink-subtle">
                  {detail}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Subtle gold divider line */}
      <div className="relative mx-auto h-px w-full max-w-7xl bg-gradient-to-r from-transparent via-metal-border/60 to-transparent" />
    </section>
  );
}
