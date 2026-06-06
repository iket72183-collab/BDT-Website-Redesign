-- Add the "AI Consultation" request type: a standalone one-time paid service
-- ($500). It is uncapped on purpose (absent from LIMITED_REQUEST_TYPES), so it
-- never counts against the monthly plan limits. Stripe billing is not wired yet.
--
-- Postgres 12+ allows ADD VALUE inside a transaction as long as the new value
-- isn't used in the same transaction (it isn't here).
ALTER TYPE "RequestType" ADD VALUE 'ai_consultation';
