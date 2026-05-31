-- BDT Connect — tenant physical address.
-- Surfaced in booking-reminder emails. All columns nullable (mobile-service
-- tenants have no storefront). Apply with `prisma migrate deploy`, then
-- `prisma generate`.

ALTER TABLE "tenants"
  ADD COLUMN "address"  TEXT,
  ADD COLUMN "city"     TEXT,
  ADD COLUMN "state"    TEXT,
  ADD COLUMN "zip_code" TEXT;
