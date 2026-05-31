-- BDT Connect — booking engine: tenant policy fields + booking reminder
-- tracking + critical compound indexes.
-- Apply with `prisma migrate deploy`. Run `prisma generate` after.

-- ----------------------------------------------------------------------------
-- tenants: timezone + booking policy
-- ----------------------------------------------------------------------------
ALTER TABLE "tenants"
  ADD COLUMN "timezone"                  TEXT    NOT NULL DEFAULT 'America/Chicago',
  ADD COLUMN "slot_interval_minutes"     INT     NOT NULL DEFAULT 15,
  ADD COLUMN "auto_invoice"              BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "booking_lead_time_hours"   INT     NOT NULL DEFAULT 1,
  ADD COLUMN "booking_window_days"       INT     NOT NULL DEFAULT 60,
  ADD COLUMN "cancellation_policy_hours" INT     NOT NULL DEFAULT 24;

-- ----------------------------------------------------------------------------
-- bookings: reminder tracking + late-cancellation flag
-- ----------------------------------------------------------------------------
ALTER TABLE "bookings"
  ADD COLUMN "late_cancellation"           BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "reminder_24h_scheduled_for"  TIMESTAMPTZ,
  ADD COLUMN "reminder_24h_sent_at"        TIMESTAMPTZ,
  ADD COLUMN "reminder_1h_scheduled_for"   TIMESTAMPTZ,
  ADD COLUMN "reminder_1h_sent_at"         TIMESTAMPTZ;

-- ----------------------------------------------------------------------------
-- Indexes — replace the old (tenant, staff, starts_at) with the 4-col
-- version (status included) so per-staff availability queries can
-- skip the bookings table read entirely (covering index).
-- ----------------------------------------------------------------------------
DROP INDEX IF EXISTS "bookings_tenant_staff_starts_idx";
DROP INDEX IF EXISTS "bookings_tenant_client_idx";

CREATE INDEX "bookings_tenant_staff_starts_status_idx"
  ON "bookings" ("tenant_id", "staff_id", "starts_at", "status");

CREATE INDEX "bookings_tenant_client_starts_idx"
  ON "bookings" ("tenant_id", "client_id", "starts_at");

-- Reminder sweep — used by reminderService.processOverdueReminders to find
-- bookings whose 24h / 1h reminder should fire. Indexed on (starts_at, status)
-- because the sweep is global (cross-tenant).
CREATE INDEX "bookings_starts_status_idx"
  ON "bookings" ("starts_at", "status");
