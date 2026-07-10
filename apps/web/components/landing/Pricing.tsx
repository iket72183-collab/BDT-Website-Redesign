import Link from 'next/link';
import { Card, CardEyebrow, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';

// Mirrors apps/api/src/lib/plans.ts. Keep in sync — there's no fetch endpoint
// for plan metadata on the marketing site.
const tiers = [
  {
    name: 'Premium',
    price: 100,
    tagline: 'Everything your business needs online',
    features: [
      'AI-generated creative assets (flyers, promos, graphics, social visuals)',
      'Social media management (posts, captions, scheduling, engagement)',
      'Website updates and maintenance (edits, fixes, calendar updates)',
      'Monthly performance report (social growth, website traffic, insights)',
      'Direct messaging to your BDT team',
    ],
  },
];

const consultation = {
  name: 'AI Consultation',
  price: 500,
  description:
    'We come to you — on-site or remote AI agent installation, workflow automation, and setup for your small business. One flat fee, no surprises.',
};

export function Pricing() {
  return (
    <section
      id="plans"
      className="connect-section relative mx-auto w-full max-w-7xl scroll-mt-28 px-8 py-16 sm:px-10 sm:py-28"
    >
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 size-[34rem] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-metal-rose/[0.035] blur-3xl" />
      <div className="mx-auto max-w-3xl text-center">
        <div className="font-body text-caption uppercase tracking-label text-metal-rose">
          Plans
        </div>
        <h2 className="mt-4 font-display text-[1.9rem] leading-[1.1] sm:text-display-xl text-ink-primary">
          One plan. <span className="text-metal">Everything you need.</span>
        </h2>
        <p className="mt-5 font-body text-body-sm leading-relaxed text-ink-muted sm:mt-6 sm:text-body-lg">
          Service starts on signup. Add hands-on AI setup when your business needs
          implementation support.
        </p>
      </div>

      <div className="relative mx-auto mt-8 grid max-w-5xl items-stretch gap-4 sm:mt-16 sm:gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        {tiers.map((t) => (
          <Card
            key={t.name}
            framed
            hover
            className="service-visual-card flex h-full flex-col overflow-hidden border-metal-rose/45 p-6 shadow-glow-strong sm:p-8 lg:scale-[1.035]"
          >
            <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full border border-metal-rose/20 bg-metal-rose/[0.035] shadow-glow-strong" />
            <CardEyebrow>Plan</CardEyebrow>
            <CardTitle>{t.name}</CardTitle>
            <p className="mt-3 font-body text-body-sm leading-relaxed text-ink-muted sm:text-body-md">
              {t.tagline}
            </p>

            <div className="mt-5 rounded-xl border border-metal-border/30 bg-bg-inset/80 p-4 sm:mt-6 sm:p-5">
              <span className="font-display text-display-lg text-metal-shimmer">${t.price}</span>
              <span className="ml-1 font-body text-body-md text-ink-muted">/ month</span>
              <div className="mt-1 font-body text-caption uppercase tracking-label text-ink-subtle">
                Service starts on signup
              </div>
            </div>

            <ul className="mt-5 space-y-2.5 sm:mt-6 sm:space-y-3">
              {t.features.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-3 font-body text-body-sm text-ink-primary"
                >
                  <svg
                    className="mt-1 size-4 shrink-0 text-metal-rose"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 10.5l4 4 8-9" />
                  </svg>
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <div className="mt-7 sm:mt-8">
              <Link href="#connect-contact" className="block">
                <Button
                  asAnchor
                  variant="primary"
                  size="md"
                  className="w-full"
                >
                  Get Started
                </Button>
              </Link>
            </div>
          </Card>
        ))}

        <Card hover className="service-visual-card relative flex h-full flex-col overflow-hidden p-6 sm:p-8 lg:my-4">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-metal-rose/70 to-transparent"
          />
          <CardEyebrow>One-time setup</CardEyebrow>
          <CardTitle>{consultation.name}</CardTitle>
          <p className="mt-3 font-body text-body-sm leading-relaxed text-ink-muted sm:text-body-md">
            {consultation.description}
          </p>

          <div className="mt-5 rounded-xl border border-metal-border/30 bg-bg-inset/70 p-4 sm:mt-6 sm:p-5">
            <span className="font-display text-display-lg text-metal">${consultation.price}</span>
            {' '}
            <span className="ml-1 font-body text-body-md text-ink-muted">one-time</span>
            <div className="mt-1 font-body text-caption uppercase tracking-label text-ink-subtle">
              On-site or remote implementation
            </div>
          </div>

          <div className="mt-auto pt-7 sm:pt-8">
            <Link href="#connect-contact" className="block">
              <Button asAnchor variant="ghost" size="md" className="w-full">
                Ask About AI Consultation
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </section>
  );
}
