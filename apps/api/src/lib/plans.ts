/**
 * Plan definition — single source of truth.
 *
 * BDT Connect is a single-plan product: one "Premium" plan at $100/month.
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
    price: 100,
    currency: 'usd',
    interval: 'month',
    features: [
      '4 AI-generated creative assets (flyers, promos, graphics, social visuals)',
      '12 social media requests (posts, captions, scheduling, engagement)',
      '4 website update requests (edits, fixes, maintenance, calendar updates)',
      '1 monthly performance report (social growth, website traffic, insights)',
      'Unlimited direct messaging to your BDT team',
      'Additional requests available at $25 each',
    ],
    description: 'Full-service digital presence management',
  },
} as const;

export type PlanId = keyof typeof PLANS;
export type Plan = (typeof PLANS)[PlanId];

/**
 * Per-request-type monthly limits. Mirror of `PLAN_LIMITS` in
 * `@bdt/shared-types` — the API can't import that source package at runtime
 * (it ships compiled JS), so the values live here too and must stay in sync.
 *
 * The four "limited" types each have a monthly cap; over-limit requests are a
 * flat $25 add-on (`addon_price_cents`), invoiced separately. `general` and
 * `file_upload` are uncapped.
 */
export const PLAN_LIMITS = {
  premium: {
    ai_creative: 4,
    social_media: 12,
    website_update: 4,
    report_request: 1,
    addon_price_cents: 2500,
  },
} as const;

export const LIMITED_REQUEST_TYPES = [
  'ai_creative',
  'social_media',
  'website_update',
  'report_request',
] as const;

/**
 * "AI Consultation" — a standalone one-time service ($500): on-site/remote AI
 * consultation, agent installation, and workflow automation. It is deliberately
 * NOT in LIMITED_REQUEST_TYPES, so `monthlyLimitFor` returns null for it and it
 * never counts against the monthly plan caps.
 *
 * PAYMENT STUB: Stripe is not wired for this charge yet. This constant mirrors
 * `AI_CONSULTATION_PRICE_CENTS` in `@bdt/shared-types` (the API ships compiled
 * JS and can't import that package at runtime — keep the two in sync).
 * TODO(stripe): create a one-time charge for this amount on request creation.
 */
export const AI_CONSULTATION_PRICE_CENTS = 50000;

export type LimitedRequestType = (typeof LIMITED_REQUEST_TYPES)[number];

/** Monthly cap for a request type on a plan, or `null` if the type is
 *  uncapped (general / file_upload). */
export function monthlyLimitFor(tier: PlanId, type: string): number | null {
  if (!(LIMITED_REQUEST_TYPES as readonly string[]).includes(type)) return null;
  return (PLAN_LIMITS[tier] as Record<string, number>)[type] ?? null;
}
