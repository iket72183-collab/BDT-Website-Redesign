-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('instagram', 'facebook', 'tiktok', 'google_business', 'x_twitter', 'youtube', 'linkedin', 'other');

-- CreateEnum
CREATE TYPE "SocialAccessMethod" AS ENUM ('delegated', 'credentials', 'create_for_me');

-- CreateEnum
CREATE TYPE "SocialAccountStatus" AS ENUM ('pending', 'access_granted', 'active', 'revoked', 'needs_attention');

-- CreateTable
CREATE TABLE "social_accounts" (
  "id"                UUID                  NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"         UUID                  NOT NULL,
  "platform"          "SocialPlatform"      NOT NULL,
  "handle"            TEXT,
  "access_method"     "SocialAccessMethod"  NOT NULL,
  "status"            "SocialAccountStatus" NOT NULL DEFAULT 'pending',
  "secret_ciphertext" TEXT,
  "secret_updated_at" TIMESTAMPTZ,
  "notes"             TEXT,
  "created_at"        TIMESTAMPTZ           NOT NULL DEFAULT now(),
  "updated_at"        TIMESTAMPTZ           NOT NULL,
  CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "social_accounts_tenant_id_platform_key" ON "social_accounts"("tenant_id", "platform");

-- CreateIndex
CREATE INDEX "social_accounts_tenant_id_idx" ON "social_accounts"("tenant_id");

-- AddForeignKey
ALTER TABLE "social_accounts"
  ADD CONSTRAINT "social_accounts_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
