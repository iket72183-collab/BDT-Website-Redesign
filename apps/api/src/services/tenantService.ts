import { rawPrisma } from '../lib/db.js';
import { HttpError } from '../middleware/error.js';
import { getTenantId } from '../lib/tenantContext.js';
import { logEvent } from './platformEventService.js';
import { PLANS } from '../lib/plans.js';
import { stripe } from '../lib/stripe.js';
import { logger } from '../lib/logger.js';

const TENANT_PUBLIC_SELECT = {
  id: true,
  slug: true,
  businessName: true,
  businessType: true,
  logoUrl: true,
  brandColor: true,
  address: true,
  city: true,
  state: true,
  zipCode: true,
  websiteUrl: true,
  instagramUrl: true,
  facebookUrl: true,
  tiktokUrl: true,
  googleBusinessUrl: true,
  subscriptionTier: true,
  subscriptionStatus: true,
  pendingTier: true,
  pendingTierEffectiveAt: true,
  onboardingCompleted: true,
  onboardingCompletedAt: true,
  isActive: true,
  createdAt: true,
} as const;

/**
 * Tenant detail for the client dashboard. Augments stored fields with plan
 * features (derived from PLANS) and the live trial end (from Stripe — we
 * don't mirror it locally so the value never goes stale).
 */
export async function getCurrentTenant() {
  const tenantId = getTenantId();
  const tenant = await rawPrisma.tenant.findUnique({
    where: { id: tenantId },
    select: { ...TENANT_PUBLIC_SELECT, stripeSubscriptionId: true },
  });
  if (!tenant) throw new HttpError(404, 'not_found', 'not_found');

  const plan = PLANS[tenant.subscriptionTier];
  const trialEnd = await getTrialEnd(tenant.stripeSubscriptionId);

  return {
    ...tenant,
    plan,
    trialEnd: trialEnd?.toISOString() ?? null,
  };
}

export async function updateTenant(data: {
  businessName?: string;
  logoUrl?: string | null;
  brandColor?: string | null;
}) {
  const tenantId = getTenantId();
  const tenant = await rawPrisma.tenant.update({
    where: { id: tenantId },
    data,
    select: TENANT_PUBLIC_SELECT,
  });
  await logEvent('tenant.updated', data);
  return tenant;
}

export async function updateTenantProfile(data: {
  websiteUrl?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  tiktokUrl?: string | null;
  googleBusinessUrl?: string | null;
}) {
  const tenantId = getTenantId();
  const tenant = await rawPrisma.tenant.update({
    where: { id: tenantId },
    data,
    select: TENANT_PUBLIC_SELECT,
  });
  await logEvent('tenant.profile_updated', data);
  return tenant;
}

export async function getSubscription() {
  const tenantId = getTenantId();
  const tenant = await rawPrisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      subscriptionTier: true,
      subscriptionStatus: true,
      pendingTier: true,
      pendingTierEffectiveAt: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
    },
  });
  if (!tenant) throw new HttpError(404, 'not_found');

  const trialEnd = await getTrialEnd(tenant.stripeSubscriptionId);

  return {
    ...tenant,
    plan: PLANS[tenant.subscriptionTier],
    trialEnd: trialEnd?.toISOString() ?? null,
  };
}

/**
 * Pull the live trial-end timestamp from Stripe. Soft fail — if Stripe is
 * unreachable we return null rather than failing the dashboard request, and
 * the UI just hides the trial banner.
 */
async function getTrialEnd(stripeSubscriptionId: string | null): Promise<Date | null> {
  if (!stripeSubscriptionId) return null;
  try {
    const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    return sub.trial_end ? new Date(sub.trial_end * 1000) : null;
  } catch (err) {
    logger.warn({ err, stripeSubscriptionId }, 'tenant.trial_end_lookup_failed');
    return null;
  }
}
