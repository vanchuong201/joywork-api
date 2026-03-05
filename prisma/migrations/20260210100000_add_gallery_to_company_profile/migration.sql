-- AlterTable: add gallery (JSONB) to company_profiles
ALTER TABLE "company_profiles" ADD COLUMN IF NOT EXISTS "gallery" JSONB;
