/**
 * Plan definition — single source of truth.
 *
 * BDT Connect is a single-plan product: one "Premium" plan at $150/month.
 * (Was a Basic/Premium two-tier model; collapsed to one plan with no free
 * trial — clients sign up, pay, and work starts immediately.)
 *
 * Backend reads PLANS to surface features in tenant responses and validate
 * tier inputs. Pricing here is INFORMATIONAL — Stripe is the source of truth
 * for actual billing. The number below is mirrored for display only.
 */

export const PLANS = {
  premium: {
    id: 'premium',
    name: 'Premium',
    price: 150,
    currency: 'usd',
    interval: 'month',
    requestsPerMonth: 999, // effectively unlimited
    features: [
      'Social media management',
      'Website maintenance & redesign',
      'AI-generated flyers & promo assets',
      'Unlimited service requests',
      '24/7 AI support',
      'Monthly performance reports',
    ],
    description: 'Full-service digital presence management',
  },
} as const;

export type PlanId = keyof typeof PLANS;
export type Plan = (typeof PLANS)[PlanId];
