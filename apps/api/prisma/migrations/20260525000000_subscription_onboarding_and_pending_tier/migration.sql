-- Distinguish registered accounts from Stripe-confirmed trials, and persist
-- period-end plan changes plus a short-lived subscription creation claim.
ALTER TABLE "tenants"
  ALTER COLUMN "subscription_status" SET DEFAULT 'incomplete',
  ADD COLUMN IF NOT EXISTS "pending_tier" "SubscriptionTier",
  ADD COLUMN IF NOT EXISTS "pending_tier_effective_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "subscription_provisioning_at" TIMESTAMPTZ;

-- Pre-launch safety: an unfinished signup must not inherit trial access from
-- the historical default. Completed onboardings preserve their live status.
UPDATE "tenants"
SET "subscription_status" = 'incomplete'
WHERE "onboarding_completed" = FALSE
  AND "stripe_subscription_id" IS NULL;

CREATE TYPE "EmailDeliveryStatus" AS ENUM ('pending', 'sent', 'failed');

ALTER TABLE "messages"
  ADD COLUMN IF NOT EXISTS "email_delivery_status" "EmailDeliveryStatus" NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "email_delivered_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "email_last_error" TEXT;
