-- BDT Connect — Expo device push tokens.
-- One row per (user, device). Workers dispatch push via the Expo Push
-- Service. Apply with `prisma migrate deploy`, then `prisma generate`.

CREATE TABLE "device_push_tokens" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "user_id"      UUID         NOT NULL,
  "tenant_id"    UUID,
  "token"        TEXT         NOT NULL,
  "platform"     TEXT         NOT NULL,
  "device_name"  TEXT,
  "is_active"    BOOLEAN      NOT NULL DEFAULT TRUE,
  "last_seen_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "created_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"   TIMESTAMPTZ  NOT NULL,
  CONSTRAINT "device_push_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "device_push_tokens_token_key" ON "device_push_tokens" ("token");
CREATE UNIQUE INDEX "device_push_tokens_user_id_token_key" ON "device_push_tokens" ("user_id", "token");
CREATE INDEX "device_push_tokens_user_id_idx" ON "device_push_tokens" ("user_id");
CREATE INDEX "device_push_tokens_tenant_id_idx" ON "device_push_tokens" ("tenant_id");

ALTER TABLE "device_push_tokens"
  ADD CONSTRAINT "device_push_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
