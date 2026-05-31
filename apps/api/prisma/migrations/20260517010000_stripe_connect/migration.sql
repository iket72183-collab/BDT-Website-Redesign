-- BDT Connect — Stripe Connect platform fee + audit + idempotency tables.
-- Apply with `prisma migrate deploy`. Run `prisma generate` after.

-- ----------------------------------------------------------------------------
-- stripe_connect_accounts: add requirements_due + last_synced_at
-- ----------------------------------------------------------------------------
ALTER TABLE "stripe_connect_accounts"
  ADD COLUMN "requirements_due" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "last_synced_at"   TIMESTAMPTZ;

-- ----------------------------------------------------------------------------
-- platform_fees: one row per successful client payment
-- ----------------------------------------------------------------------------
CREATE TABLE "platform_fees" (
  "id"                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"                  UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "payment_id"                 UUID NOT NULL UNIQUE REFERENCES "payments"("id") ON DELETE CASCADE,
  "stripe_payment_intent_id"   TEXT NOT NULL,
  "gross_amount_cents"         INT  NOT NULL,
  "platform_fee_cents"         INT  NOT NULL,
  "net_amount_cents"           INT  NOT NULL,
  "fee_percent"                INT  NOT NULL,
  "currency"                   VARCHAR(3) NOT NULL DEFAULT 'usd',
  "created_at"                 TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "platform_fees_tenant_created_idx"
  ON "platform_fees"("tenant_id", "created_at" DESC);

-- ----------------------------------------------------------------------------
-- subscription_events: business-level audit log of billing state changes
-- ----------------------------------------------------------------------------
CREATE TYPE "SubscriptionEventType" AS ENUM (
  'created', 'upgraded', 'downgraded', 'cancelled',
  'reactivated', 'payment_failed', 'payment_succeeded'
);

CREATE TABLE "subscription_events" (
  "id"                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"                UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "event_type"               "SubscriptionEventType" NOT NULL,
  "from_tier"                "SubscriptionTier",
  "to_tier"                  "SubscriptionTier",
  "stripe_subscription_id"   TEXT,
  "stripe_event_id"          TEXT NOT NULL UNIQUE,
  "created_at"               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "subscription_events_tenant_created_idx"
  ON "subscription_events"("tenant_id", "created_at" DESC);

-- ----------------------------------------------------------------------------
-- processed_stripe_events: inbound-webhook idempotency
-- ----------------------------------------------------------------------------
CREATE TABLE "processed_stripe_events" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "stripe_event_id"  TEXT NOT NULL UNIQUE,
  "event_type"       TEXT NOT NULL,
  "endpoint"         TEXT NOT NULL,
  "processed_at"     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "processed_stripe_events_processed_at_idx"
  ON "processed_stripe_events"("processed_at");
