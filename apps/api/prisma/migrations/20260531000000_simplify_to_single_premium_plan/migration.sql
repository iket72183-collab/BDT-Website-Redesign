-- Simplify the subscription model to a single "Premium" plan ($150/mo) and add
-- two new request types (ai_creative, report_request).
--
-- Order matters: existing `basic` rows are migrated to `premium` while the old
-- enum still contains `basic`, THEN the SubscriptionTier enum is recreated
-- without `basic` (the USING cast would fail on any remaining `basic` value).

-- 1. Backfill any existing `basic` tenants / pending tiers / event tiers to `premium`.
UPDATE "tenants" SET "subscription_tier" = 'premium' WHERE "subscription_tier" = 'basic';
UPDATE "tenants" SET "pending_tier" = 'premium' WHERE "pending_tier" = 'basic';
UPDATE "subscription_events" SET "from_tier" = 'premium' WHERE "from_tier" = 'basic';
UPDATE "subscription_events" SET "to_tier" = 'premium' WHERE "to_tier" = 'basic';

-- 2. Recreate SubscriptionTier without `basic`.
CREATE TYPE "SubscriptionTier_new" AS ENUM ('premium');
ALTER TABLE "tenants" ALTER COLUMN "subscription_tier" DROP DEFAULT;
ALTER TABLE "tenants"
  ALTER COLUMN "subscription_tier" TYPE "SubscriptionTier_new"
  USING ("subscription_tier"::text::"SubscriptionTier_new");
ALTER TABLE "tenants"
  ALTER COLUMN "pending_tier" TYPE "SubscriptionTier_new"
  USING ("pending_tier"::text::"SubscriptionTier_new");
ALTER TABLE "subscription_events"
  ALTER COLUMN "from_tier" TYPE "SubscriptionTier_new"
  USING ("from_tier"::text::"SubscriptionTier_new");
ALTER TABLE "subscription_events"
  ALTER COLUMN "to_tier" TYPE "SubscriptionTier_new"
  USING ("to_tier"::text::"SubscriptionTier_new");
ALTER TYPE "SubscriptionTier" RENAME TO "SubscriptionTier_old";
ALTER TYPE "SubscriptionTier_new" RENAME TO "SubscriptionTier";
DROP TYPE "SubscriptionTier_old";
ALTER TABLE "tenants" ALTER COLUMN "subscription_tier" SET DEFAULT 'premium';

-- 3. Add the two new request types. (Postgres 12+ allows ADD VALUE inside a
--    transaction as long as the new value isn't used in the same transaction.)
ALTER TYPE "RequestType" ADD VALUE 'ai_creative';
ALTER TYPE "RequestType" ADD VALUE 'report_request';
