-- BDT Connect — make payments.stripe_payment_intent_id UNIQUE.
-- The payment_intent.succeeded webhook upserts by this column; a plain index
-- let Prisma's upsert type-check fail and (at runtime) risked duplicate rows
-- on a retried delivery. Apply with `prisma migrate deploy`, then
-- `prisma generate`.

DROP INDEX IF EXISTS "payments_stripe_payment_intent_id_idx";

CREATE UNIQUE INDEX "payments_stripe_payment_intent_id_key"
  ON "payments" ("stripe_payment_intent_id");
