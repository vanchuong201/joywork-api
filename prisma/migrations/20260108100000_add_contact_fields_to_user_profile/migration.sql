-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "contactEmail" TEXT,
ADD COLUMN IF NOT EXISTS "contactPhone" TEXT;
