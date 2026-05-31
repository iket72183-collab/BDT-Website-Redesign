-- BDT Connect — auth tokens.
-- Adds the refresh-token allowlist (server-side revocation) and the
-- one-time action-token table (password reset, email verify).
--
-- Apply with `prisma migrate deploy` (production) or `prisma migrate dev`
-- (development). After applying, run `prisma generate` to refresh the client.

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
CREATE TYPE "AuthTokenPurpose" AS ENUM ('password_reset', 'email_verify');

-- ----------------------------------------------------------------------------
-- refresh_tokens
-- ----------------------------------------------------------------------------
CREATE TABLE "refresh_tokens" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"          UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "tenant_id"        UUID,
  "jti"              TEXT NOT NULL UNIQUE,
  "expires_at"       TIMESTAMPTZ NOT NULL,
  "revoked_at"       TIMESTAMPTZ,
  "replaced_by_jti"  TEXT,
  "user_agent"       TEXT,
  "ip"               TEXT,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "refresh_tokens_user_id_idx"    ON "refresh_tokens"("user_id");
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- ----------------------------------------------------------------------------
-- auth_tokens (one-time use)
-- ----------------------------------------------------------------------------
CREATE TABLE "auth_tokens" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"      UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "purpose"      "AuthTokenPurpose" NOT NULL,
  "token_hash"   TEXT NOT NULL UNIQUE,
  "expires_at"   TIMESTAMPTZ NOT NULL,
  "consumed_at"  TIMESTAMPTZ,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "auth_tokens_user_purpose_idx" ON "auth_tokens"("user_id", "purpose");
CREATE INDEX "auth_tokens_expires_at_idx"   ON "auth_tokens"("expires_at");
