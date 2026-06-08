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
    // `.url()` runs first but zod still invokes this refinement on a malformed
    // value, so guard the parse: a bad URL must reject cleanly (400) rather
    // than throw an uncaught TypeError (500).
    try {
      return new URL(url).origin === new URL(process.env.PUBLIC_APP_URL).origin;
    } catch {
      return false;
    }
  }, 'Return URL must be an approved domain').optional(),
});

export type Tier = z.infer<typeof tierSchema>;
