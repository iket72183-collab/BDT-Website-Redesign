import { z } from 'zod';

// Single-plan model — only `premium` exists.
export const tierSchema = z.enum(['premium']);

export const createSubscriptionSchema = z.object({
  tier: tierSchema.default('premium'),
  /** The backend retrieves and validates this SetupIntent before subscribing. */
  setupIntentId: z.string().startsWith('seti_'),
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
