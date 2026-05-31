-- BDT Connect — initial Prisma migration.
-- Hand-written to match prisma/schema.prisma. After applying once, run
-- `prisma migrate diff` to confirm parity, then evolve via `migrate dev`.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- Enums
-- =============================================================================
CREATE TYPE "BusinessType"        AS ENUM ('salon','barbershop','gym','spa','studio','clinic','other');
CREATE TYPE "SubscriptionTier"    AS ENUM ('solo','growth','studio');
CREATE TYPE "SubscriptionStatus"  AS ENUM ('active','trialing','past_due','cancelled');
CREATE TYPE "UserRole"            AS ENUM ('owner','staff','client','platform_admin');
CREATE TYPE "PlatformAdminRole"   AS ENUM ('superadmin','support');
CREATE TYPE "BookingStatus"       AS ENUM ('pending','confirmed','in_progress','completed','cancelled','no_show');
CREATE TYPE "BookedBy"            AS ENUM ('client','staff','owner');
CREATE TYPE "InvoiceStatus"       AS ENUM ('draft','sent','paid','void','refunded');
CREATE TYPE "PaymentMethod"       AS ENUM ('card','cash','other');
CREATE TYPE "PaymentStatus"       AS ENUM ('pending','succeeded','failed','refunded');
CREATE TYPE "RefundStatus"        AS ENUM ('pending','succeeded','failed');
CREATE TYPE "NotificationType"    AS ENUM ('booking_confirmed','booking_reminder','booking_cancelled','payment_received','staff_assigned','review_request');

-- =============================================================================
-- Platform tables
-- =============================================================================
CREATE TABLE "tenants" (
  "id"                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug"                    TEXT NOT NULL UNIQUE,
  "business_name"           TEXT NOT NULL,
  "business_type"           "BusinessType" NOT NULL,
  "owner_id"                UUID,
  "logo_url"                TEXT,
  "brand_color"             VARCHAR(7),
  "stripe_customer_id"      TEXT UNIQUE,
  "stripe_subscription_id"  TEXT UNIQUE,
  "subscription_tier"       "SubscriptionTier"   NOT NULL DEFAULT 'solo',
  "subscription_status"     "SubscriptionStatus" NOT NULL DEFAULT 'trialing',
  "is_active"               BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at"              TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "tenants_subscription_status_idx" ON "tenants"("subscription_status");
CREATE INDEX "tenants_is_active_idx"           ON "tenants"("is_active");

CREATE TABLE "users" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"         UUID,
  "email"             TEXT NOT NULL,
  "phone"             TEXT,
  "password_hash"     TEXT NOT NULL,
  "first_name"        TEXT NOT NULL,
  "last_name"         TEXT NOT NULL,
  "avatar_url"        TEXT,
  "role"              "UserRole" NOT NULL,
  "is_active"         BOOLEAN NOT NULL DEFAULT TRUE,
  "email_verified_at" TIMESTAMPTZ,
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "users_tenant_email_unique" UNIQUE ("tenant_id","email")
);
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");
CREATE INDEX "users_role_idx"      ON "users"("role");
CREATE INDEX "users_email_idx"     ON "users"("email");

ALTER TABLE "tenants" ADD CONSTRAINT "tenants_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;

CREATE TABLE "platform_admins" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"    UUID NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "role"       "PlatformAdminRole" NOT NULL DEFAULT 'support',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- Profiles
-- =============================================================================
CREATE TABLE "staff_profiles" (
  "id"                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"              UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id"                UUID NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "title"                  TEXT,
  "bio"                    TEXT,
  "color_hex"              VARCHAR(7) NOT NULL DEFAULT '#C9A882',
  "is_accepting_bookings"  BOOLEAN NOT NULL DEFAULT TRUE,
  "working_hours"          JSONB,
  "created_at"             TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "staff_profiles_tenant_id_idx"            ON "staff_profiles"("tenant_id");
CREATE INDEX "staff_profiles_tenant_accepting_idx"     ON "staff_profiles"("tenant_id","is_accepting_bookings");

CREATE TABLE "client_profiles" (
  "id"                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"                   UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id"                     UUID NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "notes"                       TEXT,
  "preferred_staff_id"          UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "preferred_staff_profile_id"  UUID REFERENCES "staff_profiles"("id") ON DELETE SET NULL,
  "total_visits"                INT NOT NULL DEFAULT 0,
  "lifetime_value_cents"        INT NOT NULL DEFAULT 0,
  "referral_source"             TEXT,
  "created_at"                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "client_profiles_tenant_id_idx"             ON "client_profiles"("tenant_id");
CREATE INDEX "client_profiles_tenant_pref_staff_idx"     ON "client_profiles"("tenant_id","preferred_staff_id");

-- =============================================================================
-- Catalog
-- =============================================================================
CREATE TABLE "services" (
  "id"                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"            UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name"                 TEXT NOT NULL,
  "description"          TEXT,
  "category"             TEXT,
  "duration_minutes"     INT NOT NULL,
  "price_cents"          INT NOT NULL,
  "currency"             VARCHAR(3) NOT NULL DEFAULT 'usd',
  "buffer_time_minutes"  INT NOT NULL DEFAULT 0,
  "is_active"            BOOLEAN NOT NULL DEFAULT TRUE,
  "is_bookable_online"   BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "services_tenant_id_idx"          ON "services"("tenant_id");
CREATE INDEX "services_tenant_active_idx"      ON "services"("tenant_id","is_active");
CREATE INDEX "services_tenant_category_idx"    ON "services"("tenant_id","category");

CREATE TABLE "service_staff" (
  "id"                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"             UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "service_id"            UUID NOT NULL REFERENCES "services"("id") ON DELETE CASCADE,
  "staff_id"              UUID NOT NULL REFERENCES "staff_profiles"("id") ON DELETE CASCADE,
  "price_override_cents"  INT,
  CONSTRAINT "service_staff_service_staff_unique" UNIQUE ("service_id","staff_id")
);
CREATE INDEX "service_staff_tenant_id_idx" ON "service_staff"("tenant_id");
CREATE INDEX "service_staff_staff_id_idx"  ON "service_staff"("staff_id");

CREATE TABLE "packages" (
  "id"                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"          UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name"               TEXT NOT NULL,
  "description"        TEXT,
  "sessions_included"  INT NOT NULL,
  "price_cents"        INT NOT NULL,
  "expiry_days"        INT,
  "is_active"          BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at"         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "packages_tenant_id_idx"     ON "packages"("tenant_id");
CREATE INDEX "packages_tenant_active_idx" ON "packages"("tenant_id","is_active");

-- =============================================================================
-- Scheduling
-- =============================================================================
CREATE TABLE "availability_templates" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"     UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "staff_id"      UUID NOT NULL REFERENCES "staff_profiles"("id") ON DELETE CASCADE,
  "day_of_week"   SMALLINT NOT NULL CHECK ("day_of_week" BETWEEN 0 AND 6),
  "start_time"    VARCHAR(5) NOT NULL,
  "end_time"      VARCHAR(5) NOT NULL,
  "is_available"  BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX "availability_templates_tenant_staff_idx" ON "availability_templates"("tenant_id","staff_id");
CREATE INDEX "availability_templates_staff_dow_idx"    ON "availability_templates"("staff_id","day_of_week");

CREATE TABLE "availability_overrides" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"     UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "staff_id"      UUID NOT NULL REFERENCES "staff_profiles"("id") ON DELETE CASCADE,
  "date"          DATE NOT NULL,
  "is_available"  BOOLEAN NOT NULL,
  "start_time"    VARCHAR(5),
  "end_time"      VARCHAR(5),
  "reason"        TEXT,
  CONSTRAINT "availability_overrides_staff_date_unique" UNIQUE ("staff_id","date")
);
CREATE INDEX "availability_overrides_tenant_date_idx" ON "availability_overrides"("tenant_id","date");

-- =============================================================================
-- Bookings
-- =============================================================================
CREATE TABLE "bookings" (
  "id"                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"             UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "client_id"             UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "staff_id"              UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "service_id"            UUID NOT NULL REFERENCES "services"("id") ON DELETE RESTRICT,
  "starts_at"             TIMESTAMPTZ NOT NULL,
  "ends_at"               TIMESTAMPTZ NOT NULL,
  "status"                "BookingStatus" NOT NULL DEFAULT 'pending',
  "notes"                 TEXT,
  "internal_notes"        TEXT,
  "booked_by"             "BookedBy" NOT NULL,
  "cancellation_reason"   TEXT,
  "cancelled_at"          TIMESTAMPTZ,
  "cancelled_by_id"       UUID,
  "reminder_sent_at"      TIMESTAMPTZ,
  "created_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ("ends_at" > "starts_at")
);
CREATE INDEX "bookings_tenant_starts_idx"         ON "bookings"("tenant_id","starts_at");
CREATE INDEX "bookings_tenant_staff_starts_idx"   ON "bookings"("tenant_id","staff_id","starts_at");
CREATE INDEX "bookings_tenant_client_idx"         ON "bookings"("tenant_id","client_id");
CREATE INDEX "bookings_tenant_status_idx"         ON "bookings"("tenant_id","status");

CREATE TABLE "booking_status_history" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"        UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "booking_id"       UUID NOT NULL REFERENCES "bookings"("id") ON DELETE CASCADE,
  "previous_status"  "BookingStatus",
  "new_status"       "BookingStatus" NOT NULL,
  "changed_by_id"    UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "note"             TEXT,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "booking_status_history_tenant_booking_idx" ON "booking_status_history"("tenant_id","booking_id");
CREATE INDEX "booking_status_history_booking_created_idx" ON "booking_status_history"("booking_id","created_at");

-- =============================================================================
-- Payments
-- =============================================================================
CREATE TABLE "invoices" (
  "id"                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"                UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "booking_id"               UUID REFERENCES "bookings"("id") ON DELETE SET NULL,
  "client_id"                UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "subtotal_cents"           INT NOT NULL,
  "discount_amount_cents"    INT NOT NULL DEFAULT 0,
  "tax_amount_cents"         INT NOT NULL DEFAULT 0,
  "total_cents"              INT NOT NULL,
  "currency"                 VARCHAR(3) NOT NULL DEFAULT 'usd',
  "status"                   "InvoiceStatus" NOT NULL DEFAULT 'draft',
  "due_date"                 DATE,
  "paid_at"                  TIMESTAMPTZ,
  "stripe_payment_intent_id" TEXT,
  "created_at"               TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "invoices_tenant_id_idx"           ON "invoices"("tenant_id");
CREATE INDEX "invoices_tenant_status_idx"       ON "invoices"("tenant_id","status");
CREATE INDEX "invoices_tenant_client_idx"       ON "invoices"("tenant_id","client_id");
CREATE INDEX "invoices_stripe_pi_idx"           ON "invoices"("stripe_payment_intent_id");

CREATE TABLE "invoice_line_items" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"        UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "invoice_id"       UUID NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
  "service_id"       UUID REFERENCES "services"("id") ON DELETE SET NULL,
  "description"      TEXT NOT NULL,
  "quantity"         INT NOT NULL DEFAULT 1,
  "unit_price_cents" INT NOT NULL,
  "total_cents"      INT NOT NULL
);
CREATE INDEX "invoice_line_items_invoice_idx"  ON "invoice_line_items"("invoice_id");
CREATE INDEX "invoice_line_items_tenant_idx"   ON "invoice_line_items"("tenant_id");

CREATE TABLE "payments" (
  "id"                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"                UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "invoice_id"               UUID NOT NULL REFERENCES "invoices"("id") ON DELETE RESTRICT,
  "client_id"                UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "amount_cents"             INT NOT NULL,
  "currency"                 VARCHAR(3) NOT NULL DEFAULT 'usd',
  "method"                   "PaymentMethod" NOT NULL,
  "status"                   "PaymentStatus" NOT NULL DEFAULT 'pending',
  "stripe_payment_intent_id" TEXT,
  "stripe_charge_id"         TEXT,
  "processed_at"             TIMESTAMPTZ,
  "created_at"               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "payments_tenant_id_idx"        ON "payments"("tenant_id");
CREATE INDEX "payments_tenant_status_idx"    ON "payments"("tenant_id","status");
CREATE INDEX "payments_invoice_idx"          ON "payments"("invoice_id");
CREATE INDEX "payments_stripe_pi_idx"        ON "payments"("stripe_payment_intent_id");
CREATE INDEX "payments_stripe_charge_idx"    ON "payments"("stripe_charge_id");

CREATE TABLE "refunds" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"        UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "payment_id"       UUID NOT NULL REFERENCES "payments"("id") ON DELETE RESTRICT,
  "amount_cents"     INT NOT NULL,
  "reason"           TEXT,
  "stripe_refund_id" TEXT,
  "status"           "RefundStatus" NOT NULL DEFAULT 'pending',
  "refunded_by_id"   UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "refunds_tenant_id_idx"  ON "refunds"("tenant_id");
CREATE INDEX "refunds_payment_idx"    ON "refunds"("payment_id");
CREATE INDEX "refunds_stripe_idx"     ON "refunds"("stripe_refund_id");

CREATE TABLE "stripe_connect_accounts" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"           UUID NOT NULL UNIQUE REFERENCES "tenants"("id") ON DELETE CASCADE,
  "stripe_account_id"   TEXT NOT NULL UNIQUE,
  "onboarding_complete" BOOLEAN NOT NULL DEFAULT FALSE,
  "payouts_enabled"     BOOLEAN NOT NULL DEFAULT FALSE,
  "charges_enabled"     BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- Notifications
-- =============================================================================
CREATE TABLE "notifications" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"      UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id"        UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type"           "NotificationType" NOT NULL,
  "title"          TEXT NOT NULL,
  "body"           TEXT NOT NULL,
  "is_read"        BOOLEAN NOT NULL DEFAULT FALSE,
  "read_at"        TIMESTAMPTZ,
  "reference_type" TEXT,
  "reference_id"   UUID,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "notifications_tenant_id_idx"               ON "notifications"("tenant_id");
CREATE INDEX "notifications_user_unread_created_idx"     ON "notifications"("user_id","is_read","created_at" DESC);
CREATE INDEX "notifications_reference_idx"               ON "notifications"("reference_type","reference_id");

CREATE TABLE "notification_preferences" (
  "id"                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"              UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id"                UUID NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "email_enabled"          BOOLEAN NOT NULL DEFAULT TRUE,
  "sms_enabled"            BOOLEAN NOT NULL DEFAULT FALSE,
  "push_enabled"           BOOLEAN NOT NULL DEFAULT TRUE,
  "booking_reminders"      BOOLEAN NOT NULL DEFAULT TRUE,
  "marketing"              BOOLEAN NOT NULL DEFAULT FALSE,
  "reminder_hours_before"  INT NOT NULL DEFAULT 24
);
CREATE INDEX "notification_preferences_tenant_id_idx" ON "notification_preferences"("tenant_id");

-- =============================================================================
-- Platform analytics
-- =============================================================================
CREATE TABLE "platform_events" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"  UUID REFERENCES "tenants"("id") ON DELETE SET NULL,
  "user_id"    UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "event_type" TEXT NOT NULL,
  "payload"    JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "platform_events_type_created_idx"   ON "platform_events"("event_type","created_at" DESC);
CREATE INDEX "platform_events_tenant_created_idx" ON "platform_events"("tenant_id","created_at" DESC);

-- =============================================================================
-- updated_at triggers
-- =============================================================================
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tenants','users','staff_profiles','client_profiles','services',
    'bookings','invoices','stripe_connect_accounts'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
END $$;
