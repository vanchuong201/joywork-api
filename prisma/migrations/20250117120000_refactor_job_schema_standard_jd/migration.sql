-- Refactor Job schema to standard JD format
-- Remove old fields and add new structured fields

-- Step 1: Delete all existing job data (as requested by user)
DELETE FROM "jobs";

-- Step 2: Drop old columns
ALTER TABLE "jobs" DROP COLUMN IF EXISTS "description";
ALTER TABLE "jobs" DROP COLUMN IF EXISTS "requirements";
ALTER TABLE "jobs" DROP COLUMN IF EXISTS "responsibilities";
ALTER TABLE "jobs" DROP COLUMN IF EXISTS "benefits";

-- Step 3: Add new required fields
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "generalInfo" TEXT NOT NULL DEFAULT '';
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "mission" TEXT NOT NULL DEFAULT '';
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "tasks" TEXT NOT NULL DEFAULT '';
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "knowledge" TEXT NOT NULL DEFAULT '';
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "skills" TEXT NOT NULL DEFAULT '';
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "attitude" TEXT NOT NULL DEFAULT '';

-- Step 4: Add new optional fields
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "kpis" TEXT;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "authority" TEXT;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "relationships" TEXT;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "careerPath" TEXT;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "benefitsIncome" TEXT;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "benefitsPerks" TEXT;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "contact" TEXT;

-- Step 5: Update skills column type (from String[] to TEXT)
-- Note: The old skills was String[], new skills is TEXT
-- We need to handle this carefully - drop and recreate
ALTER TABLE "jobs" DROP COLUMN IF EXISTS "skills";
ALTER TABLE "jobs" ADD COLUMN "skills" TEXT NOT NULL DEFAULT '';
