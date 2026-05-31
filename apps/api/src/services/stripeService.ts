import Stripe from 'stripe';
import { stripe } from '../lib/stripe.js';
import { config } from '../config/env.js';
import { rawPrisma, db } from '../lib/db.js';
import { HttpError } from '../middleware/error.js';
import { getTenantId, runAsTenant } from '../lib/tenantContext.js';
import { logEvent } from './platformEventService.js';
import type { SubscriptionTier } from '@prisma/client';
import { PLANS, TRIAL_DAYS, TIER_RANK } from '../lib/plans.js';

/**
 * THE single Stripe SDK call surface. Nothing outside this file should import
 * `stripe` or `Stripe`.
 *
 * BDT collects monthly subscriptions from agency clients (Basic / Premium).
 * 14-day free trial — no charge until the trial ends. No Stripe Connect:
 * we are not a marketplace.
 */

// =============================================================================
// §CUSTOMERS
// =============================================================================

/** Get or create the Stripe Customer for a tenant. Idempotent. */
export async function createOrRetrieveCustomer(tenant: {
  id: string;
  slug: string;
  businessName: string;
  stripeCustomerId: string | null;
  owner: { email: string } | null;
}): Promise<string> {
  if (tenant.stripeCustomerId) return tenant.stripeCustomerId;

  const customer = await stripe.customers.create(
    {
      ...(tenant.owner?.email ? { email: tenant.owner.email } : {}),
      name: tenant.businessName,
      metadata: { tenantId: tenant.id, tenantSlug: tenant.slug },
    },
    { idempotencyKey: `customer:create:${tenant.id}` },
  );
  await rawPrisma.tenant.update({
    where: { id: tenant.id },
    data: { stripeCustomerId: customer.id },
  });
  return customer.id;
}

// =============================================================================
// §SUBSCRIPTIONS
// =============================================================================

function priceIdForTier(tier: SubscriptionTier): string {
  const id = config.stripe.priceIds[tier];
  if (!id) {
    throw new HttpError(
      500,
      'price_id_not_configured',
      'price_id_not_configured',
      { tier, hint: `Set STRIPE_${tier.toUpperCase()}_PRICE_ID` },
    );
  }
  return id;
}

interface CreateSubscriptionInput {
  tenantId: string;
  tier: SubscriptionTier;
  /** A succeeded SetupIntent created for this tenant/customer. */
  setupIntentId: string;
}

/**
 * Create a Stripe subscription with a 14-day free trial only after Stripe has
 * confirmed card setup. Subscription creation is claimed in the database
 * before the external write so competing taps cannot create orphaned bills.
 *
 * A stale claim is recoverable: Stripe's tenant-level idempotency key returns
 * the same initial subscription if the API crashed after creating it.
 */
export async function createSubscription(
  input: CreateSubscriptionInput,
): Promise<{ subscriptionId: string; status: Stripe.Subscription.Status; trialEnd: Date | null }> {
  const tenant = await rawPrisma.tenant.findUnique({
    where: { id: input.tenantId },
    include: { owner: { select: { email: true } } },
  });
  if (!tenant) throw new HttpError(404, 'tenant_not_found');
  if (tenant.stripeSubscriptionId) {
    throw new HttpError(409, 'subscription_exists', 'subscription_exists');
  }

  const setupIntent = await stripe.setupIntents.retrieve(input.setupIntentId);
  if (setupIntent.status !== 'succeeded') {
    throw new HttpError(
      400,
      'Payment setup was not completed successfully.',
      'SETUP_INTENT_INCOMPLETE',
    );
  }
  if (setupIntent.metadata?.tenantId !== input.tenantId) {
    throw new HttpError(403, 'Payment setup does not match this account.', 'SETUP_INTENT_MISMATCH');
  }

  const claimTime = new Date();
  const staleClaimBefore = new Date(Date.now() - 10 * 60 * 1000);
  const claim = await rawPrisma.tenant.updateMany({
    where: {
      id: input.tenantId,
      stripeSubscriptionId: null,
      OR: [
        { subscriptionProvisioningAt: null },
        { subscriptionProvisioningAt: { lt: staleClaimBefore } },
      ],
    },
    data: { subscriptionProvisioningAt: claimTime },
  });
  if (claim.count !== 1) {
    throw new HttpError(
      409,
      'Subscription setup is already in progress.',
      'SUBSCRIPTION_PROVISIONING',
    );
  }

  let subscription: Stripe.Subscription | null = null;
  try {
    const customerId = await createOrRetrieveCustomer({
      id: tenant.id,
      slug: tenant.slug,
      businessName: tenant.businessName,
      stripeCustomerId: tenant.stripeCustomerId,
      owner: tenant.owner ? { email: tenant.owner.email } : null,
    });
    const intentCustomerId =
      typeof setupIntent.customer === 'string' ? setupIntent.customer : setupIntent.customer?.id;
    if (intentCustomerId !== customerId) {
      throw new HttpError(403, 'Payment setup does not match this account.', 'SETUP_INTENT_MISMATCH');
    }
    const paymentMethodId =
      typeof setupIntent.payment_method === 'string'
        ? setupIntent.payment_method
        : setupIntent.payment_method?.id;
    if (!paymentMethodId) {
      throw new HttpError(400, 'Payment setup did not include a card.', 'SETUP_INTENT_INCOMPLETE');
    }

    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    subscription = await stripe.subscriptions.create(
      {
        customer: customerId,
        items: [{ price: priceIdForTier(input.tier) }],
        trial_period_days: TRIAL_DAYS,
        default_payment_method: paymentMethodId,
        metadata: { tenantId: input.tenantId, tier: input.tier },
      },
      { idempotencyKey: `sub:create:${input.tenantId}` },
    );

    const stored = await rawPrisma.tenant.updateMany({
      where: { id: input.tenantId, stripeSubscriptionId: null },
      data: {
        subscriptionTier: input.tier,
        subscriptionStatus: mapStripeSubStatus(subscription.status),
        stripeSubscriptionId: subscription.id,
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
        subscriptionProvisioningAt: null,
      },
    });

    if (stored.count !== 1) {
      const winner = await rawPrisma.tenant.findUnique({
        where: { id: input.tenantId },
        select: { stripeSubscriptionId: true },
      });
      if (winner?.stripeSubscriptionId !== subscription.id) {
        await stripe.subscriptions.cancel(subscription.id);
        throw new HttpError(409, 'This account already has a subscription.', 'SUBSCRIPTION_EXISTS');
      }
    }
  } catch (err) {
    await rawPrisma.tenant.updateMany({
      where: { id: input.tenantId, subscriptionProvisioningAt: claimTime },
      data: { subscriptionProvisioningAt: null },
    }).catch(() => undefined);
    throw err;
  }

  await logEvent('subscription.created', {
    tenantId: input.tenantId,
    tier: input.tier,
    trialEnd: subscription.trial_end,
  });

  return {
    subscriptionId: subscription.id,
    status: subscription.status,
    trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
  };
}

/**
 * Start a 14-day trial without capturing a card up front. Two paths:
 *
 * 1. Billing configured → calls `stripe.subscriptions.create` with
 *    `trial_period_days` but no `default_payment_method`. Stripe will move
 *    the subscription to `incomplete` when the trial ends and fire
 *    `customer.subscription.trial_will_end` 3 days prior so we can prompt
 *    the client to add a card.
 * 2. Billing NOT configured (`config.billingEnabled === false`) → DB-only
 *    trial. Tenant is marked `trialing` with no Stripe linkage so the
 *    client can still sign up and use messaging while Stripe is being set
 *    up. When billing is wired later, the tenant's first card-capture call
 *    promotes the trial into a real subscription.
 */
export async function startTrialWithoutCard(input: {
  tenantId: string;
  tier: SubscriptionTier;
}): Promise<{ subscriptionId: string | null; status: string; trialEnd: Date | null }> {
  const tenant = await rawPrisma.tenant.findUnique({
    where: { id: input.tenantId },
    include: { owner: { select: { email: true } } },
  });
  if (!tenant) throw new HttpError(404, 'tenant_not_found');
  if (tenant.stripeSubscriptionId || tenant.onboardingCompleted) {
    throw new HttpError(409, 'subscription_exists', 'subscription_exists');
  }

  if (!config.billingEnabled) {
    // DB-only path. Mirror the shape Stripe would have produced so the
    // dashboard and trial banner code don't need a special case.
    const trialEnd = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    await rawPrisma.tenant.update({
      where: { id: input.tenantId },
      data: {
        subscriptionTier: input.tier,
        subscriptionStatus: 'trialing',
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
      },
    });
    await logEvent('subscription.created', {
      tenantId: input.tenantId,
      tier: input.tier,
      trialEnd: Math.floor(trialEnd.getTime() / 1000),
      billingEnabled: false,
    });
    return { subscriptionId: null, status: 'trialing', trialEnd };
  }

  const customerId = await createOrRetrieveCustomer({
    id: tenant.id,
    slug: tenant.slug,
    businessName: tenant.businessName,
    stripeCustomerId: tenant.stripeCustomerId,
    owner: tenant.owner ? { email: tenant.owner.email } : null,
  });
  const subscription = await stripe.subscriptions.create(
    {
      customer: customerId,
      items: [{ price: priceIdForTier(input.tier) }],
      trial_period_days: TRIAL_DAYS,
      metadata: { tenantId: input.tenantId, tier: input.tier, noCard: 'true' },
    },
    { idempotencyKey: `sub:create-no-card:${input.tenantId}` },
  );
  await rawPrisma.tenant.update({
    where: { id: input.tenantId },
    data: {
      subscriptionTier: input.tier,
      subscriptionStatus: mapStripeSubStatus(subscription.status),
      stripeSubscriptionId: subscription.id,
      onboardingCompleted: true,
      onboardingCompletedAt: new Date(),
    },
  });
  await logEvent('subscription.created', {
    tenantId: input.tenantId,
    tier: input.tier,
    trialEnd: subscription.trial_end,
    noCard: true,
  });
  return {
    subscriptionId: subscription.id,
    status: subscription.status,
    trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
  };
}

/**
 * Change the tier on an active subscription. Upgrades take effect immediately
 * (with proration); downgrades apply at the end of the current period so we
 * don't refund mid-month.
 */
export async function updateSubscription(
  tenantId: string,
  subscriptionId: string,
  newTier: SubscriptionTier,
): Promise<{
  subscription: Stripe.Subscription;
  pendingTier: SubscriptionTier | null;
  pendingTierEffectiveAt: Date | null;
}> {
  const newPrice = priceIdForTier(newTier);
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const item = subscription.items.data[0];
  if (!item) throw new HttpError(500, 'subscription_corrupt', 'subscription_corrupt');

  const isUpgrade = tierRank(newTier) > priceIdToTierRank(item.price.id);
  const isDowngrade = tierRank(newTier) < priceIdToTierRank(item.price.id);

  if (isDowngrade) {
    const schedule =
      typeof subscription.schedule === 'string'
        ? await stripe.subscriptionSchedules.retrieve(subscription.schedule)
        : subscription.schedule ??
          await stripe.subscriptionSchedules.create({ from_subscription: subscriptionId });

    await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: 'release',
      phases: [
        {
          start_date: subscription.current_period_start,
          end_date: subscription.current_period_end,
          items: subscription.items.data.map((currentItem) => ({
            price: currentItem.price.id,
            ...(currentItem.quantity ? { quantity: currentItem.quantity } : {}),
          })),
        },
        {
          start_date: subscription.current_period_end,
          items: [{ price: newPrice }],
          metadata: { ...subscription.metadata, tier: newTier },
        },
      ],
    });
    const effectiveAt = new Date(subscription.current_period_end * 1000);
    await rawPrisma.tenant.update({
      where: { id: tenantId },
      data: { pendingTier: newTier, pendingTierEffectiveAt: effectiveAt },
    });
    return { subscription, pendingTier: newTier, pendingTierEffectiveAt: effectiveAt };
  }

  if (subscription.schedule) {
    const scheduleId =
      typeof subscription.schedule === 'string' ? subscription.schedule : subscription.schedule.id;
    await stripe.subscriptionSchedules.release(scheduleId);
  }

  const updated = isUpgrade ? await stripe.subscriptions.update(subscriptionId, {
    items: [{ id: item.id, price: newPrice }],
    proration_behavior: 'create_prorations',
    metadata: { ...subscription.metadata, tier: newTier },
  }) : subscription;
  await rawPrisma.tenant.update({
    where: { id: tenantId },
    data: { pendingTier: null, pendingTierEffectiveAt: null },
  });
  return { subscription: updated, pendingTier: null, pendingTierEffectiveAt: null };
}

/**
 * Cancel at end of period — the client keeps access until the date they've
 * already paid through. Immediate cancellation is intentionally not exposed.
 */
export async function cancelSubscription(
  subscriptionId: string,
): Promise<{ cancelAt: Date | null }> {
  const sub = await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
  await rawPrisma.tenant.updateMany({
    where: { stripeSubscriptionId: subscriptionId },
    data: { subscriptionStatus: mapStripeSubStatus(sub.status) },
  });
  return { cancelAt: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null };
}

/** Hosted billing portal link — client manages PM / receipts / cancel. */
export async function getBillingPortalSession(args: {
  stripeCustomerId: string;
  tenantSlug: string;
  returnUrl?: string;
}): Promise<{ url: string }> {
  const session = await stripe.billingPortal.sessions.create({
    customer: args.stripeCustomerId,
    return_url: args.returnUrl ?? `${appUrl()}/settings/billing?slug=${encodeURIComponent(args.tenantSlug)}`,
  });
  return { url: session.url };
}

/**
 * SetupIntent for the onboarding card-capture screen. Returns a client_secret
 * that the RN PaymentSheet uses to collect + tokenize a payment method
 * without charging it. The succeeded SetupIntent id is later verified on the
 * server via `createSubscription({ setupIntentId })`.
 */
export async function createSetupIntent(tenantId: string): Promise<{ clientSecret: string }> {
  const tenant = await rawPrisma.tenant.findUnique({
    where: { id: tenantId },
    include: { owner: { select: { email: true } } },
  });
  if (!tenant) throw new HttpError(404, 'tenant_not_found');

  const customerId = await createOrRetrieveCustomer({
    id: tenant.id,
    slug: tenant.slug,
    businessName: tenant.businessName,
    stripeCustomerId: tenant.stripeCustomerId,
    owner: tenant.owner ? { email: tenant.owner.email } : null,
  });

  const intent = await stripe.setupIntents.create(
    {
      customer: customerId,
      usage: 'off_session',
      payment_method_types: ['card'],
      metadata: { tenantId },
    },
    { idempotencyKey: `setup:${tenantId}` },
  );

  if (!intent.client_secret) {
    throw new HttpError(500, 'setup_intent_failed', 'setup_intent_failed');
  }
  return { clientSecret: intent.client_secret };
}

// =============================================================================
// §INTERNAL — status mapping (exported for webhook + unit tests)
// =============================================================================

/** Map Stripe's subscription.status enum into our smaller domain set. */
export function mapStripeSubStatus(
  s: Stripe.Subscription.Status,
): 'active' | 'trialing' | 'past_due' | 'cancelled' {
  switch (s) {
    case 'active': return 'active';
    case 'trialing': return 'trialing';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    default: return 'cancelled';
  }
}

export function tierRank(t: SubscriptionTier): number {
  return TIER_RANK[t];
}

function priceIdToTierRank(currentPriceId: string): number {
  const ids = config.stripe.priceIds;
  if (currentPriceId === ids.basic) return TIER_RANK.basic;
  if (currentPriceId === ids.premium) return TIER_RANK.premium;
  // Unrecognized price id (legacy) — treat as the lowest so any change is an
  // upgrade. Safer than holding access back.
  return 0;
}

/** Reverse map a Stripe price id back to a SubscriptionTier. */
export function tierFromPriceId(priceId: string | undefined): SubscriptionTier | null {
  if (!priceId) return null;
  const ids = config.stripe.priceIds;
  if (priceId === ids.basic) return 'basic';
  if (priceId === ids.premium) return 'premium';
  return null;
}

function appUrl(): string {
  return config.publicAppUrl ?? config.publicUrl;
}

// =============================================================================
// §LEGACY-COMPAT — convenience shims for callers using the request-scoped form.
// =============================================================================

/** Tenant billing portal — derives customer + slug from the current tenant. */
export async function createBillingPortalSession(args: { returnUrl: string }) {
  const tenantId = getTenantId();
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { stripeCustomerId: true, slug: true },
  });
  if (!tenant?.stripeCustomerId) {
    throw new HttpError(400, 'no_stripe_customer', 'no_stripe_customer');
  }
  return getBillingPortalSession({
    stripeCustomerId: tenant.stripeCustomerId,
    tenantSlug: tenant.slug,
    returnUrl: args.returnUrl,
  });
}

// Re-export runAsTenant + PLANS for webhook + route consumers.
export { runAsTenant, PLANS };
