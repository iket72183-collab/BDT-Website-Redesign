/**
 * Plan definitions — single source of truth.
 *
 * Backend reads PLANS to surface features in tenant responses, validate tier
 * inputs, and reason about upgrade/downgrade paths. The mobile app should
 * import the same constant (via a thin re-export from shared-types if/when
 * we extract it) so plan UI never drifts from billing reality.
 *
 * Pricing here is INFORMATIONAL — Stripe is the source of truth for actual
 * billing. The numbers below are mirrored for display only.
 */

export const PLANS = {
  basic: {
    id: 'basic',
    name: 'Basic',
    price: 100,
    currency: 'usd',
    interval: 'month',
    trialDays: 14,
    requestsPerMonth: 5,
    features: [
      'Website redesign',
      'Website maintenance',
      'Direct messaging to BDT team',
    ],
    notIncluded: [
      'Social media management',
      'Monthly performance report',
      'Priority message response',
    ],
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    price: 175,
    currency: 'usd',
    interval: 'month',
    trialDays: 14,
    requestsPerMonth: 20,
    features: [
      'Website redesign',
      'Website maintenance',
      'Full social media management (all platforms)',
      'Monthly performance report',
      'Priority message response',
      'Direct messaging to BDT team',
    ],
    notIncluded: [] as string[],
  },
} as const;

export type PlanId = keyof typeof PLANS;
export type Plan = (typeof PLANS)[PlanId];

export const TRIAL_DAYS = 14;

export const TIER_RANK: Record<PlanId, number> = {
  basic: 1,
  premium: 2,
};
