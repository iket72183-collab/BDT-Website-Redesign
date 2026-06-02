import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { ok } from '../lib/response.js';
import { rawPrisma } from '../lib/db.js';
import { getTenantId } from '../lib/tenantContext.js';
import { HttpError } from '../middleware/error.js';
import { config } from '../config/env.js';
import {
  billingPortalSchema,
  createSubscriptionSchema,
} from '../validators/stripe.validators.js';
import * as stripeService from '../services/stripeService.js';

/** Routes that hit Stripe directly fail fast if billing isn't configured. */
function requireBilling(): void {
  if (!config.billingEnabled) {
    throw new HttpError(
      503,
      'Billing is not configured yet.',
      'billing_unavailable',
    );
  }
}

/**
 * Client-billing routes. BDT charges the client a single monthly subscription
 * — the Premium plan ($150/mo). No free trial, no tier upgrades, no Connect.
 *
 * Mounted under /api/stripe behind verifyToken + tenantScope. All routes
 * are client-only.
 */
export const stripeRouter = Router();
stripeRouter.use(requireRole('client'));

/**
 * POST /api/stripe/setup-intent
 *
 * Returns a SetupIntent client_secret for the RN PaymentSheet to tokenize
 * a card without charging it. The resulting SetupIntent id is passed to
 * /subscription/create.
 */
stripeRouter.post(
  '/setup-intent',
  asyncHandler(async (_req, res) => {
    requireBilling();
    const tenantId = getTenantId();
    ok(res, await stripeService.createSetupIntent(tenantId));
  }),
);

/**
 * POST /api/stripe/subscription/create
 *
 * Body: { setupIntentId } (tier defaults to the single Premium plan). The card
 * captured by the SetupIntent is attached as the default and billed
 * immediately — no trial. Card capture is required up front so we never leave
 * subs in `incomplete`.
 */
stripeRouter.post(
  '/subscription/create',
  validate({ body: createSubscriptionSchema }),
  asyncHandler(async (req, res) => {
    requireBilling();
    const tenantId = getTenantId();
    const result = await stripeService.createSubscription({
      tenantId,
      tier: req.body.tier,
      setupIntentId: req.body.setupIntentId,
    });
    ok(res, {
      subscriptionId: result.subscriptionId,
      status: result.status,
      trialEnd: result.trialEnd?.toISOString() ?? null,
    });
  }),
);

/**
 * DELETE /api/stripe/subscription — cancel at period end.
 */
stripeRouter.delete(
  '/subscription',
  asyncHandler(async (_req, res) => {
    requireBilling();
    const tenantId = getTenantId();
    const tenant = await rawPrisma.tenant.findUnique({
      where: { id: tenantId },
      select: { stripeSubscriptionId: true },
    });
    if (!tenant?.stripeSubscriptionId) {
      throw new HttpError(404, 'no_active_subscription', 'no_active_subscription');
    }
    const result = await stripeService.cancelSubscription(tenant.stripeSubscriptionId);
    ok(res, { cancelAt: result.cancelAt?.toISOString() ?? null });
  }),
);

/**
 * POST /api/stripe/billing-portal — hosted Stripe page (PM, receipts, cancel).
 */
stripeRouter.post(
  '/billing-portal',
  validate({ body: billingPortalSchema }),
  asyncHandler(async (req, res) => {
    requireBilling();
    const tenantId = getTenantId();
    const tenant = await rawPrisma.tenant.findUnique({
      where: { id: tenantId },
      select: { stripeCustomerId: true, slug: true },
    });
    if (!tenant?.stripeCustomerId) {
      throw new HttpError(400, 'no_stripe_customer', 'no_stripe_customer');
    }
    const session = await stripeService.getBillingPortalSession({
      stripeCustomerId: tenant.stripeCustomerId,
      tenantSlug: tenant.slug,
      returnUrl: req.body.returnUrl,
    });
    ok(res, session);
  }),
);
