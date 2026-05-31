-- Add the pre-payment status in its own migration. PostgreSQL requires a new
-- value in an existing enum to be committed before it is used in writes or
-- column defaults in a later migration.
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'incomplete' BEFORE 'trialing';
