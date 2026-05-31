import { z } from 'zod';

export const tierSchema = z.enum(['basic', 'premium']);

export const createSubscriptionSchema = z.object({
  tier: tierSchema,
  /** The backend retrieves and validates this SetupIntent before starting a trial. */
  setupIntentId: z.string().startsWith('seti_'),
});

/** No-card trial start. Used when Stripe isn't configured yet (soft launch) or
 *  when the client elects to defer card capture until day 15. */
export const startTrialSchema = z.object({
  tier: tierSchema,
});

export const upgradeSubscriptionSchema = z.object({
  tier: tierSchema,
});

/** Used by `POST /billing-portal` — where Stripe sends the user back. */
export const billingPortalSchema = z.object({
  returnUrl: z.string().url().refine((url) => {
    if (url.startsWith('bdtconnect://')) return true;
    if (!process.env.PUBLIC_APP_URL) return false;
    return new URL(url).origin === new URL(process.env.PUBLIC_APP_URL).origin;
  }, 'Return URL must be an approved domain').optional(),
});

export type Tier = z.infer<typeof tierSchema>;
