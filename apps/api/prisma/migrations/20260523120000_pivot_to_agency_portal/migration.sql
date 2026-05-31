-- =============================================================================
-- Pivot to BDT Talent Group agency client portal
--
-- Removes the booking/calendar/multi-tenant SaaS surface and reshapes the
-- schema around the new product: agency clients pick Basic/Premium, message
-- the team, and track BDT's work on their behalf.
--
-- Tables dropped: bookings, booking_status_history, availability_templates,
-- availability_overrides, services, service_staff, staff_profiles, packages,
-- stripe_connect_accounts, platform_fees, client_profiles, invoices,
-- invoice_line_items, payments, refunds.
--
-- Tables added: messages.
--
-- Enums shrunk: subscription_tier (solo|growth|studio → basic|premium),
-- user_role (owner|staff|client|platform_admin → client|platform_admin).
--
-- Tenants table reshaped: drops booking-policy fields, adds social URLs +
-- onboarding flags + internal notes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. DROP DEPENDENT TABLES — order matters because of FKs.
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS "refunds"                  CASCADE;
DROP TABLE IF EXISTS "payments"                 CASCADE;
DROP TABLE IF EXISTS "platform_fees"            CASCADE;
DROP TABLE IF EXISTS "invoice_line_items"       CASCADE;
DROP TABLE IF EXISTS "invoices"                 CASCADE;
DROP TABLE IF EXISTS "booking_status_history"   CASCADE;
DROP TABLE IF EXISTS "bookings"                 CASCADE;
DROP TABLE IF EXISTS "availability_overrides"   CASCADE;
DROP TABLE IF EXISTS "availability_templates"   CASCADE;
DROP TABLE IF EXISTS "service_staff"            CASCADE;
DROP TABLE IF EXISTS "services"                 CASCADE;
DROP TABLE IF EXISTS "packages"                 CASCADE;
DROP TABLE IF EXISTS "staff_profiles"           CASCADE;
DROP TABLE IF EXISTS "client_profiles"          CASCADE;
DROP TABLE IF EXISTS "stripe_connect_accounts"  CASCADE;

-- -----------------------------------------------------------------------------
-- 2. DROP ENUMS that no longer have referents.
-- -----------------------------------------------------------------------------
DROP TYPE IF EXISTS "BookingStatus";
DROP TYPE IF EXISTS "BookedBy";
DROP TYPE IF EXISTS "InvoiceStatus";
DROP TYPE IF EXISTS "PaymentMethod";
DROP TYPE IF EXISTS "PaymentStatus";
DROP TYPE IF EXISTS "RefundStatus";

-- -----------------------------------------------------------------------------
-- 3. RESHAPE NotificationType — drop booking_* and staff_assigned / review_request.
-- -----------------------------------------------------------------------------
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
CREATE TYPE "NotificationType" AS ENUM ('message_reply', 'account_update', 'payment_received');

-- Map any existing rows to the new set. Anything booking-shaped becomes
-- account_update; payment_received stays; anything else becomes account_update.
ALTER TABLE "notifications"
  ALTER COLUMN "type" TYPE "NotificationType"
  USING (
    CASE "type"::text
      WHEN 'payment_received' THEN 'payment_received'
      ELSE 'account_update'
    END
  )::"NotificationType";

DROP TYPE "NotificationType_old";

-- -----------------------------------------------------------------------------
-- 4. RESHAPE SubscriptionTier — solo|growth|studio → basic|premium.
--    Existing rows: solo → basic, growth|studio → premium.
-- -----------------------------------------------------------------------------
ALTER TYPE "SubscriptionTier" RENAME TO "SubscriptionTier_old";
CREATE TYPE "SubscriptionTier" AS ENUM ('basic', 'premium');

-- Drop the default before the type swap (PG requires no default referencing the old type).
ALTER TABLE "tenants" ALTER COLUMN "subscription_tier" DROP DEFAULT;

ALTER TABLE "tenants"
  ALTER COLUMN "subscription_tier" TYPE "SubscriptionTier"
  USING (
    CASE "subscription_tier"::text
      WHEN 'solo' THEN 'basic'
      ELSE 'premium'
    END
  )::"SubscriptionTier";

ALTER TABLE "tenants"
  ALTER COLUMN "subscription_tier" SET DEFAULT 'basic';

-- subscription_events.from_tier / to_tier are nullable — same mapping.
ALTER TABLE "subscription_events"
  ALTER COLUMN "from_tier" TYPE "SubscriptionTier"
  USING (
    CASE "from_tier"::text
      WHEN 'solo' THEN 'basic'::"SubscriptionTier"
      WHEN 'growth' THEN 'premium'::"SubscriptionTier"
      WHEN 'studio' THEN 'premium'::"SubscriptionTier"
      ELSE NULL
    END
  );

ALTER TABLE "subscription_events"
  ALTER COLUMN "to_tier" TYPE "SubscriptionTier"
  USING (
    CASE "to_tier"::text
      WHEN 'solo' THEN 'basic'::"SubscriptionTier"
      WHEN 'growth' THEN 'premium'::"SubscriptionTier"
      WHEN 'studio' THEN 'premium'::"SubscriptionTier"
      ELSE NULL
    END
  );

DROP TYPE "SubscriptionTier_old";

-- -----------------------------------------------------------------------------
-- 5. EXPAND SubscriptionEventType — add trial_started / trial_ending.
-- -----------------------------------------------------------------------------
ALTER TYPE "SubscriptionEventType" ADD VALUE IF NOT EXISTS 'trial_started';
ALTER TYPE "SubscriptionEventType" ADD VALUE IF NOT EXISTS 'trial_ending';

-- -----------------------------------------------------------------------------
-- 6. RESHAPE UserRole — owner|staff|client|platform_admin → client|platform_admin.
--    Existing rows: owner|staff → client, platform_admin stays.
-- -----------------------------------------------------------------------------
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
CREATE TYPE "UserRole" AS ENUM ('client', 'platform_admin');

ALTER TABLE "users"
  ALTER COLUMN "role" TYPE "UserRole"
  USING (
    CASE "role"::text
      WHEN 'platform_admin' THEN 'platform_admin'
      ELSE 'client'
    END
  )::"UserRole";

DROP TYPE "UserRole_old";

-- -----------------------------------------------------------------------------
-- 7. RESHAPE tenants — drop booking-engine fields, add agency-portal fields.
-- -----------------------------------------------------------------------------
ALTER TABLE "tenants"
  DROP COLUMN IF EXISTS "slot_interval_minutes",
  DROP COLUMN IF EXISTS "auto_invoice",
  DROP COLUMN IF EXISTS "booking_lead_time_hours",
  DROP COLUMN IF EXISTS "booking_window_days",
  DROP COLUMN IF EXISTS "cancellation_policy_hours",
  DROP COLUMN IF EXISTS "timezone";

-- business_type becomes optional (keeping the column for context).
ALTER TABLE "tenants" ALTER COLUMN "business_type" DROP NOT NULL;

-- New columns.
ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "website_url"             TEXT,
  ADD COLUMN IF NOT EXISTS "instagram_url"           TEXT,
  ADD COLUMN IF NOT EXISTS "facebook_url"            TEXT,
  ADD COLUMN IF NOT EXISTS "tiktok_url"              TEXT,
  ADD COLUMN IF NOT EXISTS "google_business_url"     TEXT,
  ADD COLUMN IF NOT EXISTS "onboarding_completed"    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "onboarding_completed_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "notes"                   TEXT;

-- -----------------------------------------------------------------------------
-- 8. RESHAPE notification_preferences — drop booking_reminders + reminder_hours_before.
-- -----------------------------------------------------------------------------
ALTER TABLE "notification_preferences"
  DROP COLUMN IF EXISTS "booking_reminders",
  DROP COLUMN IF EXISTS "reminder_hours_before";

-- -----------------------------------------------------------------------------
-- 9. CREATE messages table.
-- -----------------------------------------------------------------------------
CREATE TYPE "MessageStatus" AS ENUM ('unread', 'read', 'archived');

CREATE TABLE "messages" (
  "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"  UUID         NOT NULL,
  "user_id"    UUID         NOT NULL,
  "subject"    TEXT,
  "body"       TEXT         NOT NULL,
  "status"     "MessageStatus" NOT NULL DEFAULT 'unread',
  "sent_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "created_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT "messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "messages_tenant_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE,
  CONSTRAINT "messages_user_fkey"
    FOREIGN KEY ("user_id")   REFERENCES "users"   ("id") ON DELETE CASCADE
);

CREATE INDEX "messages_tenant_id_idx" ON "messages" ("tenant_id");
CREATE INDEX "messages_user_id_idx"   ON "messages" ("user_id");
CREATE INDEX "messages_status_idx"    ON "messages" ("status");
