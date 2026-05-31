import express, { type Request, type Response, Router } from 'express';
import type Stripe from 'stripe';
import type { SubscriptionTier } from '@prisma/client';

import { stripe } from '../lib/stripe.js';
import { config } from '../config/env.js';
import { rawPrisma } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { runAsTenant } from '../lib/tenantContext.js';
import { logEvent } from '../services/platformEventService.js';
import { notify } from '../services/notificationService.js';
import { mapStripeSubStatus, tierFromPriceId, tierRank } from '../services/stripeService.js';
import { webhookLimiter } from '../middleware/rateLimiter.js';

/** Duck-type check for Prisma's "unique constraint violation" code. */
function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
}

const SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Single webhook endpoint:
 *   /api/webhooks/stripe — subscription state changes (created/updated/deleted,
 *                          invoice paid/failed). No Connect — BDT collects
 *                          subscriptions directly, not via a marketplace.
 *
 * Claimed two-phase idempotency:
 *   1. Verify the Stripe signature (mismatch → 400, no record).
 *   2. Atomically claim processed_stripe_events by event.id as `processing`.
 *      A succeeded event is acknowledged; an in-flight event is rejected so
 *      Stripe retries instead of running side effects in parallel.
 *   3. Run the handler.
 *   4. On success: mark the claimed row `succeeded`.
 *      On failure: mark it `failed` + the error text, then —
 *      for CRITICAL events — return 500 so Stripe retries. For
 *      non-critical events return 200 (we logged the failure; Stripe
 *      retrying a debug-only event isn't useful).
 *
 * Why this matters: the old design INSERTed before running the handler.
 * A DB blip mid-handler permanently marked the event as "processed", so
 * Stripe retries got ack'd and skipped while the side-effects (e.g.
 * marking a subscription `active`) never actually landed.
 *
 * MUST be mounted with `express.raw({ type: 'application/json' })` BEFORE
 * `express.json()` — signature verification needs the raw bytes.
 */
export const webhooksRouter = Router();

webhooksRouter.post(
  '/stripe',
  webhookLimiter,
  express.raw({ type: 'application/json' }),
  handlePlatformWebhook,
);

// ============================================================================

/**
 * Events where a silently-dropped handler failure would corrupt our view of
 * a paying customer. Anything in this list → return 500 on handler failure
 * so Stripe retries; everything else → log + 200 (Stripe stops retrying).
 */
const CRITICAL_EVENT_TYPES = new Set<string>([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.trial_will_end',
  'invoice.paid',
  'invoice.payment_failed',
]);

export async function handlePlatformWebhook(req: Request, res: Response): Promise<void> {
  if (!config.stripe.webhookSecret) {
    // Billing isn't configured. Reject so misrouted Stripe deliveries don't
    // look like accepted no-ops; surface a clear 503 instead of a 200/400 mix.
    res.status(503).send('Billing webhook handler is not configured');
    return;
  }
  const event = verifySignature(req, config.stripe.webhookSecret);
  if (!event) {
    res.status(400).send('Webhook signature verification failed');
    return;
  }

  const claim = await claimEvent(event);
  if (claim === 'succeeded') {
    logger.info({ id: event.id, type: event.type }, 'webhook.duplicate_ack');
    res.json({ received: true, duplicate: true });
    return;
  }
  if (claim === 'processing') {
    logger.info({ id: event.id, type: event.type }, 'webhook.concurrent_delivery');
    res.status(409).json({ error: 'Event is already being processed' });
    return;
  }

  try {
    await dispatchEvent(event);

    await rawPrisma.processedStripeEvent.update({
      where: { stripeEventId: event.id },
      data: {
        status: 'succeeded',
        error: null,
        processedAt: new Date(),
      },
    });

    res.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Bound the stored error so a stack trace can't bloat a column.
    const truncated = message.slice(0, 2000);
    logger.error({ err, type: event.type, id: event.id }, 'webhook.handler_failed');

    // Best-effort failure marker. A failed row is claimable by the next retry.
    await rawPrisma.processedStripeEvent
      .update({
        where: { stripeEventId: event.id },
        data: { status: 'failed', error: truncated, processedAt: new Date() },
      })
      .catch((markErr) => logger.error({ markErr }, 'webhook.mark_failed_failed'));

    if (CRITICAL_EVENT_TYPES.has(event.type)) {
      // Return 500 so Stripe retries. The handler will re-run on retry
      // because the row is status='failed' not 'succeeded'.
      res.status(500).json({ error: 'Processing failed, will retry' });
    } else {
      // Non-critical event — log it and move on. We don't want Stripe
      // hammering us for an event we don't care about.
      res.json({ received: true });
    }
  }
}

type ClaimResult = 'claimed' | 'succeeded' | 'processing';

async function claimEvent(event: Stripe.Event): Promise<ClaimResult> {
  const existing = await rawPrisma.processedStripeEvent.findUnique({
    where: { stripeEventId: event.id },
  });
  if (existing?.status === 'succeeded') return 'succeeded';

  if (existing) {
    const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
    const claimed = await rawPrisma.processedStripeEvent.updateMany({
      where: {
        stripeEventId: event.id,
        OR: [
          { status: 'failed' },
          { status: 'processing', processedAt: { lt: staleBefore } },
        ],
      },
      data: { status: 'processing', error: null, processedAt: new Date() },
    });
    return claimed.count === 1 ? 'claimed' : 'processing';
  }

  try {
    await rawPrisma.processedStripeEvent.create({
      data: {
        stripeEventId: event.id,
        eventType: event.type,
        endpoint: 'platform',
        status: 'processing',
        processedAt: new Date(),
      },
    });
    return 'claimed';
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const winner = await rawPrisma.processedStripeEvent.findUnique({
      where: { stripeEventId: event.id },
    });
    return winner?.status === 'succeeded' ? 'succeeded' : 'processing';
  }
}

function verifySignature(req: Request, secret: string): Stripe.Event | null {
  const sig = req.header('stripe-signature');
  if (!sig) {
    logger.warn('webhook.no_signature');
    return null;
  }
  try {
    return stripe.webhooks.constructEvent(req.body as Buffer, sig, secret);
  } catch (err) {
    logger.warn({ err }, 'webhook.signature_failed');
    return null;
  }
}

// ============================================================================

async function dispatchEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await onSubscriptionChanged(event);
      break;
    case 'customer.subscription.trial_will_end':
      await onTrialWillEnd(event.data.object as Stripe.Subscription);
      break;
    case 'invoice.paid':
      await onInvoicePaid(event.data.object as Stripe.Invoice);
      break;
    case 'invoice.payment_failed':
      await onInvoicePaymentFailed(event.data.object as Stripe.Invoice);
      break;
    default:
      logger.debug({ type: event.type }, 'webhook.unhandled');
  }
}

async function onSubscriptionChanged(event: Stripe.Event): Promise<void> {
  const eventSub = event.data.object as Stripe.Subscription;
  const sub = await stripe.subscriptions.retrieve(eventSub.id, {
    expand: ['latest_invoice'],
  });
  const prev = (event.data as { previous_attributes?: Partial<Stripe.Subscription> }).previous_attributes;
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

  const tenant = await rawPrisma.tenant.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true, subscriptionTier: true, pendingTier: true, onboardingCompleted: true },
  });
  if (!tenant) {
    logger.warn({ customerId, id: sub.id }, 'webhook.sub.tenant_not_found');
    return;
  }

  const newTier = tierFromSubscription(sub);
  const newStatus = mapStripeSubStatus(sub.status);
  const fromTier = tenant.subscriptionTier;

  await rawPrisma.tenant.update({
    where: { id: tenant.id },
    data: {
      subscriptionStatus: newStatus,
      stripeSubscriptionId: sub.id,
      ...(newTier ? { subscriptionTier: newTier } : {}),
      ...(event.type === 'customer.subscription.created'
        ? {
            onboardingCompleted: true,
            ...(!tenant.onboardingCompleted ? { onboardingCompletedAt: new Date() } : {}),
          }
        : {}),
      ...(newTier && tenant.pendingTier === newTier
        ? { pendingTier: null, pendingTierEffectiveAt: null }
        : {}),
    },
  });

  if (event.type === 'customer.subscription.created' && !tenant.onboardingCompleted) {
    await logEvent('onboarding.completed', { tenantId: tenant.id, subscriptionId: sub.id });
  }

  const eventType = (() => {
    if (event.type === 'customer.subscription.deleted') return 'cancelled' as const;
    if (event.type === 'customer.subscription.created') return 'created' as const;
    if (newTier && fromTier && newTier !== fromTier) {
      return tierRank(newTier) > tierRank(fromTier) ? 'upgraded' : 'downgraded';
    }
    if (prev?.cancel_at_period_end === false && sub.cancel_at_period_end) return 'cancelled' as const;
    if (prev?.cancel_at_period_end === true && !sub.cancel_at_period_end) return 'reactivated' as const;
    return null;
  })();

  if (eventType) {
    await rawPrisma.subscriptionEvent.create({
      data: {
        tenantId: tenant.id,
        eventType,
        fromTier: fromTier ?? null,
        toTier: newTier ?? null,
        stripeSubscriptionId: sub.id,
        stripeEventId: event.id,
      },
    }).catch((err) => {
      if (isUniqueViolation(err)) return;
      throw err;
    });
  }

  if (event.type === 'customer.subscription.deleted') {
    // Access has ended — purge any stored social-account credentials for this
    // tenant. The accounts remain (for history); only the secrets are wiped.
    await rawPrisma.socialAccount
      .updateMany({
        where: { tenantId: tenant.id },
        data: { secretCiphertext: null, secretUpdatedAt: null },
      })
      .catch((err) => logger.error({ err, tenantId: tenant.id }, 'webhook.sub.credential_wipe_failed'));

    await notifyOwner(tenant.id, 'account_update', {
      title: 'Subscription cancelled',
      body: 'Your BDT Connect subscription will end at the close of this billing period. Re-subscribe any time to keep your account active.',
    });
  } else if (newStatus === 'past_due') {
    await notifyOwner(tenant.id, 'payment_received', {
      title: 'Payment failed — action required',
      body: 'Your subscription payment failed. Update your payment method to avoid suspension.',
    });
  }
}

async function onTrialWillEnd(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const tenant = await rawPrisma.tenant.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  if (!tenant) return;

  await notifyOwner(tenant.id, 'account_update', {
    title: 'Trial ending soon',
    body: 'Your 14-day free trial ends in 3 days. We will charge your card on the trial end date — update your billing details in Settings if needed.',
  });
}

async function onInvoicePaid(eventInv: Stripe.Invoice): Promise<void> {
  if (typeof eventInv.subscription !== 'string') return;
  const sub = await stripe.subscriptions.retrieve(eventInv.subscription, {
    expand: ['latest_invoice'],
  });
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const tenant = await rawPrisma.tenant.findFirst({ where: { stripeCustomerId: customerId } });
  if (!tenant) return;
  await rawPrisma.tenant.update({
    where: { id: tenant.id },
    data: { subscriptionStatus: mapStripeSubStatus(sub.status) },
  });
  await logEvent('subscription.invoice_paid', { tenantId: tenant.id, invoiceId: eventInv.id });
}

async function onInvoicePaymentFailed(eventInv: Stripe.Invoice): Promise<void> {
  if (typeof eventInv.subscription !== 'string') return;
  const sub = await stripe.subscriptions.retrieve(eventInv.subscription, {
    expand: ['latest_invoice'],
  });
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const tenant = await rawPrisma.tenant.findFirst({ where: { stripeCustomerId: customerId } });
  if (!tenant) return;
  await rawPrisma.tenant.update({
    where: { id: tenant.id },
    data: { subscriptionStatus: mapStripeSubStatus(sub.status) },
  });
  await notifyOwner(tenant.id, 'payment_received', {
    title: 'Subscription payment failed',
    body: "We couldn't charge your card. Update payment in Settings to keep your account active.",
  });
}

// ============================================================================
// helpers
// ============================================================================

function tierFromSubscription(sub: Stripe.Subscription): SubscriptionTier | null {
  const meta = sub.metadata?.tier as SubscriptionTier | undefined;
  if (meta === 'basic' || meta === 'premium') return meta;
  return tierFromPriceId(sub.items.data[0]?.price.id);
}

async function notifyOwner(
  tenantId: string,
  type: 'account_update' | 'payment_received' | 'message_reply',
  msg: { title: string; body: string },
): Promise<void> {
  const tenant = await rawPrisma.tenant.findUnique({
    where: { id: tenantId },
    select: { ownerId: true },
  });
  if (!tenant?.ownerId) return;
  await runAsTenant(
    { tenantId, userId: SYSTEM_ACTOR_ID, role: 'client' as never },
    async () => {
      await notify({ userId: tenant.ownerId!, type, ...msg });
    },
  );
}
