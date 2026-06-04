import Link from 'next/link';
import { Card, CardEyebrow, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';

// Mirrors apps/api/src/lib/plans.ts. Keep in sync — there's no fetch endpoint
// for plan metadata on the marketing site.
const tiers = [
  {
    name: 'Premium',
    price: 150,
    tagline: 'Everything your business needs online',
    features: [
      '4 AI-generated creative assets (flyers, promos, graphics, social visuals)',
      '12 social media requests (posts, captions, scheduling, engagement)',
      '4 website update requests (edits, fixes, maintenance, calendar updates)',
      '1 monthly performance report (social growth, website traffic, insights)',
      'Unlimited direct messaging to your BDT team',
      'Additional requests available at $25 each',
    ],
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
          One plan. <span className="text-metal">Everything you need.</span>
        </h2>
        <p className="mt-4 font-body text-body-sm leading-relaxed text-ink-muted sm:mt-6 sm:text-body-lg">
          Service starts on signup. Cancel anytime from the app's billing portal.
        </p>
      </div>

      <div className="mx-auto mt-8 grid max-w-md items-stretch gap-4 sm:mt-16 sm:gap-6">
        {tiers.map((t) => (
          <Card
            key={t.name}
            framed
            hover
            className="flex flex-col shadow-glow-strong lg:scale-[1.03]"
          >
            <CardEyebrow>Plan</CardEyebrow>
            <CardTitle>{t.name}</CardTitle>
            <p className="mt-2 font-body text-body-sm leading-relaxed text-ink-muted sm:text-body-md">{t.tagline}</p>

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

            <p className="mt-4 font-body text-caption leading-relaxed text-ink-subtle">
              Need more? Extra requests are just $25 each.
            </p>

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
      </div>
    </section>
  );
}
