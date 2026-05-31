import Link from 'next/link';
import { Card, CardEyebrow, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

// Mirrors apps/api/src/lib/plans.ts. Keep in sync — there's no fetch endpoint
// for plan metadata on the marketing site.
const tiers = [
  {
    name: 'Basic',
    price: 100,
    tagline: 'Get a professional site and a partner who keeps it running.',
    features: [
      'Website redesign',
      'Ongoing website maintenance',
      'Direct messaging with your account team',
    ],
    notIncluded: [
      'Social media management',
      'Monthly performance report',
      'Priority response',
    ],
    cta: 'mailto:BDTTalentGroup@yahoo.com?subject=Start%20Basic%20trial',
    featured: false,
  },
  {
    name: 'Premium',
    price: 175,
    tagline: 'Everything in Basic, plus active social and monthly insight.',
    features: [
      'Website redesign',
      'Ongoing website maintenance',
      'Direct messaging with your account team',
      'Social media management',
      'Monthly performance report',
      'Priority message response',
    ],
    notIncluded: [],
    cta: 'mailto:BDTTalentGroup@yahoo.com?subject=Start%20Premium%20trial',
    featured: true,
  },
];

export function Pricing() {
  return (
    <section id="plans" className="relative mx-auto w-full max-w-7xl px-5 py-14 sm:px-10 sm:py-32">
      <div className="mx-auto max-w-3xl text-center">
        <div className="font-body text-caption uppercase tracking-label text-metal-rose">
          Plans
        </div>
        <h2 className="mt-4 font-display text-[1.9rem] leading-[1.1] sm:text-display-xl text-ink-primary">
          Two plans. <span className="text-metal">Both start free.</span>
        </h2>
        <p className="mt-4 font-body text-body-sm leading-relaxed text-ink-muted sm:mt-6 sm:text-body-lg">
          14 days on us. No card needed to start. Cancel anytime from the app's billing portal.
        </p>
      </div>

      <div className="mt-8 grid items-stretch gap-4 sm:mt-16 sm:gap-6 lg:grid-cols-2 lg:max-w-4xl lg:mx-auto">
        {tiers.map((t) => (
          <Card
            key={t.name}
            framed={t.featured}
            hover
            className={
              'flex flex-col ' +
              // On mobile (single column), put the featured tier first so users see
              // it without scrolling. On lg+ the grid order resets to design order.
              (t.featured ? 'shadow-glow-strong -order-1 lg:order-none lg:scale-[1.03]' : '')
            }
          >
            <div className="flex items-center justify-between">
              <CardEyebrow>{t.featured ? 'Most popular' : 'Plan'}</CardEyebrow>
              {t.featured && <Badge tone="metal">Best value</Badge>}
            </div>
            <CardTitle>{t.name}</CardTitle>
            <p className="mt-2 font-body text-body-sm leading-relaxed text-ink-muted sm:text-body-md">{t.tagline}</p>

            <div className="mt-5 rounded-xl border border-metal-border/30 bg-bg-inset/80 p-4 sm:mt-6 sm:p-5">
              <span className="font-display text-display-lg text-metal-shimmer">${t.price}</span>
              <span className="ml-1 font-body text-body-md text-ink-muted">/ month</span>
              <div className="mt-1 font-body text-caption uppercase tracking-label text-ink-subtle">
                14-day free trial
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
              {t.notIncluded.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-3 font-body text-body-sm text-ink-subtle"
                >
                  <svg
                    className="mt-1 size-4 shrink-0"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M5 10h10" />
                  </svg>
                  <span className="line-through decoration-metal-border/40">{f}</span>
                </li>
              ))}
            </ul>

            <div className="mt-7 sm:mt-8">
              <Link href={t.cta} className="block">
                <Button
                  asAnchor
                  variant={t.featured ? 'primary' : 'ghost'}
                  size="md"
                  className="w-full"
                >
                  Start {t.name} trial
                </Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
