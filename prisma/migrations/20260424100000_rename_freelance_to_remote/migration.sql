-- Migration: Rename FREELANCE to REMOTE in EmploymentType enum
-- PostgreSQL doesn't support DROP VALUE directly, so we recreate the type

-- Step 1: Drop the default value first (it depends on the enum)
ALTER TABLE "jobs" ALTER COLUMN "employmentType" DROP DEFAULT;

-- Step 2: Temporarily change the column to TEXT type
ALTER TABLE "jobs" ALTER COLUMN "employmentType" TYPE TEXT USING "employmentType"::text;

-- Step 3: Update any existing jobs from FREELANCE to REMOTE
UPDATE "jobs" SET "employmentType" = 'REMOTE' WHERE "employmentType" = 'FREELANCE';

-- Step 4: Drop old enum type
DROP TYPE "EmploymentType";

-- Step 5: Create new enum type with REMOTE instead of FREELANCE
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'REMOTE');

-- Step 6: Change column back to enum type
ALTER TABLE "jobs" ALTER COLUMN "employmentType" TYPE "EmploymentType" USING "employmentType"::"EmploymentType";

-- Step 7: Set the default value back
ALTER TABLE "jobs" ALTER COLUMN "employmentType" SET DEFAULT 'FULL_TIME';
