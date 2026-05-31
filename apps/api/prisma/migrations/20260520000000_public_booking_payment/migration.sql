-- BDT Connect — public booking payments: link bookings to their Stripe
-- PaymentIntent + seed the system actor used for webhook-driven status
-- changes. Apply with `prisma migrate deploy`. Run `prisma generate` after.

-- ----------------------------------------------------------------------------
-- bookings: direct PaymentIntent link.
-- Lets the payment_intent.* webhook resolve the booking by PI id without an
-- invoice join. Null for free + staff-created bookings.
-- ----------------------------------------------------------------------------
ALTER TABLE "bookings"
  ADD COLUMN "stripe_payment_intent_id" TEXT;

CREATE INDEX "bookings_stripe_payment_intent_id_idx"
  ON "bookings" ("stripe_payment_intent_id");

-- ----------------------------------------------------------------------------
-- System actor.
-- A real `users` row so `booking_status_history.changed_by_id` (FK, ON DELETE
-- RESTRICT) is satisfied for webhook-driven confirmations and cancellations,
-- which have no human actor. tenant_id NULL + role platform_admin keeps it
-- outside every tenant. The id is a fixed sentinel UUID — see
-- `bookingService.SYSTEM_ACTOR_ID` and BOOKING_ENGINE.md §10.
-- ----------------------------------------------------------------------------
INSERT INTO "users" (
  "id", "tenant_id", "email", "password_hash",
  "first_name", "last_name", "role", "is_active", "created_at", "updated_at"
) VALUES (
  '00000000-0000-0000-0000-000000000000', NULL, 'system@bdtconnect.internal', '!system!',
  'BDT', 'System', 'platform_admin', false, now(), now()
) ON CONFLICT ("id") DO NOTHING;
