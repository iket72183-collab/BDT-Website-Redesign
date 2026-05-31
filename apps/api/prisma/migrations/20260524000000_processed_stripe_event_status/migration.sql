-- Add a status + error column to processed_stripe_events so the webhook
-- handler can mark rows as 'failed' (Stripe should retry) vs 'succeeded'
-- (definitely don't reprocess). Existing rows predate this change and
-- represent events that DID succeed under the old single-phase flow, so
-- backfill them as 'succeeded'.

ALTER TABLE "processed_stripe_events"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'succeeded',
  ADD COLUMN "error"  TEXT;

CREATE INDEX "processed_stripe_events_status_idx"
  ON "processed_stripe_events" ("status");
