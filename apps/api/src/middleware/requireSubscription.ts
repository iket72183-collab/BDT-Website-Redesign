import type { RequestHandler } from 'express';
import { rawPrisma } from '../lib/db.js';
import { HttpError } from './error.js';
import { asyncHandler } from './asyncHandler.js';

/**
 * Gate routes behind an active (or trialing) subscription. Runs AFTER
 * verifyToken + tenantScope so `req.auth` is populated and the request is
 * already known to be a real user.
 *
 * Decision tree:
 *
 *   1. Platform admins → pass. Plan gating is a client concept; admins
 *      manage everyone's accounts.
 *   2. Missing `req.auth.tenantId` (shouldn't happen for clients post-
 *      tenantScope) → 401, treat as auth failure rather than billing.
 *   3. Tenant not found / inactive → 403 ACCOUNT_SUSPENDED.
 *   4. Email not verified yet → 403 EMAIL_NOT_VERIFIED. (We could also
 *      gate this on a separate middleware; consolidating here keeps the
 *      "can this client use the app?" check in one place.)
 *   5. Onboarding not complete → 403 ONBOARDING_INCOMPLETE.
 *   6. Subscription status not in {active, trialing} → 402
 *      SUBSCRIPTION_REQUIRED. Returns 402 specifically (Payment Required)
 *      so the mobile client can branch on the status code alone and route
 *      the user to the billing portal.
 *
 * Apply to all post-onboarding client routes (messages, tenant profile,
 * notifications, push). Do NOT apply to /auth, /stripe, /webhooks, /health
 * — those need to work even when billing is broken so the user can fix it.
 */
export const requireSubscription: RequestHandler = asyncHandler(async (req, _res, next) => {
  const auth = req.auth;
  if (!auth) throw new HttpError(401, 'unauthorized', 'missing_token');

  if (auth.role === 'platform_admin') {
    next();
    return;
  }

  if (!auth.tenantId) {
    throw new HttpError(401, 'unauthorized', 'missing_tenant');
  }

  // One query covers all three checks (suspension, verification status,
  // subscription status) — we already paid for the round trip.
  const tenant = await rawPrisma.tenant.findUnique({
    where: { id: auth.tenantId },
    select: {
      isActive: true,
      subscriptionStatus: true,
      onboardingCompleted: true,
    },
  });

  if (!tenant) {
    throw new HttpError(403, 'tenant_not_found', 'tenant_not_found');
  }

  if (!tenant.isActive) {
    throw new HttpError(
      403,
      'Your account has been suspended. Contact BDT support to reactivate.',
      'ACCOUNT_SUSPENDED',
    );
  }

  const user = await rawPrisma.user.findUnique({
    where: { id: auth.sub },
    select: { emailVerifiedAt: true },
  });
  if (!user?.emailVerifiedAt) {
    throw new HttpError(
      403,
      'Please verify your email to continue.',
      'EMAIL_NOT_VERIFIED',
    );
  }

  if (!tenant.onboardingCompleted) {
    throw new HttpError(
      403,
      'Please complete account setup to continue.',
      'ONBOARDING_INCOMPLETE',
    );
  }

  if (tenant.subscriptionStatus !== 'active' && tenant.subscriptionStatus !== 'trialing') {
    throw new HttpError(
      402,
      'Your subscription is inactive. Please update your payment method.',
      'SUBSCRIPTION_REQUIRED',
    );
  }

  next();
});
