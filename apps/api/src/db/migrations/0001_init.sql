-- =============================================================================
-- ⚠️  SUPERSEDED — kept for reference only.
--
-- The canonical schema now lives in `apps/api/prisma/schema.prisma`.
-- Migrations are managed by Prisma in `apps/api/prisma/migrations/`.
-- Do NOT run this file against a fresh database. See DATABASE_SCHEMA.md.
--
-- This file is retained because it contains the working Postgres RLS setup,
-- which is the recommended defense-in-depth layer on top of Prisma's
-- application-level tenant scoping. Port these RLS statements when wiring
-- production-grade isolation.
-- =============================================================================

-- =============================================================================
-- BDT Connect — initial schema (legacy raw-SQL scaffold)
--
-- Multi-tenancy model: row-level isolation via `tenant_id` + Postgres RLS.
-- Every tenant-scoped table carries `tenant_id uuid not null` and has an RLS
-- policy: USING (tenant_id = current_setting('app.tenant_id')::uuid).
--
-- The application MUST connect as a non-superuser role and call
-- `set_config('app.tenant_id', $1, true)` at the start of every transaction
-- (see src/db/client.ts → withTenantClient). Superusers and the table owner
-- bypass RLS, so DO NOT run the API as the postgres superuser in production.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- Tenants (the businesses on the platform). NOT tenant-scoped itself.
-- ----------------------------------------------------------------------------
CREATE TABLE tenants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL UNIQUE,
  business_name   TEXT NOT NULL,
  category        TEXT,
  branding        JSONB NOT NULL DEFAULT '{}'::jsonb,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'suspended', 'cancelled')),
  stripe_customer_id    TEXT,
  stripe_subscription_id TEXT,
  stripe_connect_account_id TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX tenants_slug_idx ON tenants (slug) WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- Users. A single user belongs to exactly one tenant (or none, for superadmin).
-- An email may exist once per tenant — same person could have accounts at
-- multiple businesses.
-- ----------------------------------------------------------------------------
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  password_hash   TEXT NOT NULL,
  full_name       TEXT,
  role            TEXT NOT NULL
                  CHECK (role IN ('superadmin', 'owner', 'staff', 'client')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  UNIQUE (tenant_id, email),
  -- superadmin must have null tenant; everyone else must have one.
  CHECK ((role = 'superadmin') = (tenant_id IS NULL))
);

CREATE INDEX users_tenant_idx ON users (tenant_id) WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- Refresh tokens (one row per session). Hashed before storage.
-- ----------------------------------------------------------------------------
CREATE TABLE refresh_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  token_hash      TEXT NOT NULL UNIQUE,
  expires_at      TIMESTAMPTZ NOT NULL,
  revoked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);

-- ----------------------------------------------------------------------------
-- Services offered by a tenant (a haircut, a yoga class, a personal training
-- session, etc.). Used by appointments + payments.
-- ----------------------------------------------------------------------------
CREATE TABLE services (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
  price_cents     INT NOT NULL CHECK (price_cents >= 0),
  currency        TEXT NOT NULL DEFAULT 'usd',
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX services_tenant_idx ON services (tenant_id) WHERE active;

-- ----------------------------------------------------------------------------
-- Staff schedules: weekly recurring shifts. Time-off / one-off overrides go
-- in a separate `staff_schedule_overrides` table (out of scope for scaffold).
-- ----------------------------------------------------------------------------
CREATE TABLE staff_schedules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week     INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  effective_from  DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to    DATE,
  CHECK (end_time > start_time)
);

CREATE INDEX staff_schedules_lookup_idx ON staff_schedules (tenant_id, staff_user_id, day_of_week);

-- ----------------------------------------------------------------------------
-- Appointments.
-- ----------------------------------------------------------------------------
CREATE TABLE appointments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  client_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  service_id      UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  start_at        TIMESTAMPTZ NOT NULL,
  end_at          TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'booked'
                  CHECK (status IN ('booked', 'completed', 'cancelled', 'no_show')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);

CREATE INDEX appointments_tenant_time_idx ON appointments (tenant_id, start_at);
CREATE INDEX appointments_staff_time_idx ON appointments (tenant_id, staff_user_id, start_at);
CREATE INDEX appointments_client_idx ON appointments (tenant_id, client_user_id);

-- ----------------------------------------------------------------------------
-- Payments (in-app transactions via Stripe Connect — distinct from the
-- platform subscription which lives on the tenant row).
-- ----------------------------------------------------------------------------
CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  appointment_id  UUID REFERENCES appointments(id) ON DELETE SET NULL,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL, -- payer
  stripe_payment_intent_id TEXT NOT NULL UNIQUE,
  amount_cents    INT NOT NULL CHECK (amount_cents > 0),
  currency        TEXT NOT NULL,
  platform_fee_cents INT NOT NULL DEFAULT 0,
  status          TEXT NOT NULL
                  CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX payments_tenant_idx ON payments (tenant_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- updated_at trigger
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['tenants','users','services','appointments','payments'] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
END $$;

-- ============================================================================
-- Row-Level Security
--
-- Enable on every tenant-scoped table. The policy reads `app.tenant_id` —
-- a session-local GUC set by the API at the start of each transaction.
-- A separate `app.is_admin` GUC lets superadmin queries bypass.
-- ============================================================================

CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION current_is_admin() RETURNS BOOLEAN AS $$
  SELECT COALESCE(NULLIF(current_setting('app.is_admin', true), '')::boolean, false)
$$ LANGUAGE sql STABLE;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','services','staff_schedules','appointments','payments','refresh_tokens'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (current_is_admin() OR tenant_id = current_tenant_id())
         WITH CHECK (current_is_admin() OR tenant_id = current_tenant_id())',
      t
    );
  END LOOP;
END $$;
