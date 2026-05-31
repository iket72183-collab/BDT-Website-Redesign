-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('website_update', 'social_media', 'general', 'file_upload');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');

-- CreateTable
CREATE TABLE "requests" (
  "id"          UUID            NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"   UUID            NOT NULL,
  "type"        "RequestType"   NOT NULL,
  "title"       TEXT            NOT NULL,
  "description" TEXT            NOT NULL,
  "status"      "RequestStatus" NOT NULL DEFAULT 'pending',
  "attachments" JSONB           NOT NULL DEFAULT '[]',
  "created_at"  TIMESTAMPTZ     NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ     NOT NULL,
  CONSTRAINT "requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "requests_tenant_id_idx" ON "requests"("tenant_id");

-- CreateIndex
CREATE INDEX "requests_status_idx" ON "requests"("status");

-- CreateIndex
CREATE INDEX "requests_tenant_id_created_at_idx" ON "requests"("tenant_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "requests"
  ADD CONSTRAINT "requests_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
