-- Production schema drift hotfix
-- Safe to run on environments that already contain a subset of these changes.

-- 1) Ensure user_profiles has all fields expected by current Prisma schema.
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "specificAddress" TEXT;
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "dayOfBirth" INTEGER;
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "monthOfBirth" INTEGER;

-- 2) Ensure optionality/indexes match current schema intent.
ALTER TABLE "user_profiles" ALTER COLUMN "yearOfBirth" DROP NOT NULL;

-- 3) Align numeric column types with Prisma BigInt fields.
ALTER TABLE "user_profiles"
  ALTER COLUMN "expectedSalaryMin" TYPE BIGINT USING "expectedSalaryMin"::BIGINT,
  ALTER COLUMN "expectedSalaryMax" TYPE BIGINT USING "expectedSalaryMax"::BIGINT;

-- 4) Canonicalize EducationLevel enum values and preserve old rows safely.
--    - NONE -> NULL
--    - HIGH_SCHOOL -> INTERMEDIATE
--    - keep TRAINING_CENTER, COLLEGE, BACHELOR, MASTER, PHD
ALTER TABLE "jobs" ALTER COLUMN "educationLevel" TYPE TEXT USING "educationLevel"::TEXT;
ALTER TABLE "user_profiles" ALTER COLUMN "educationLevel" TYPE TEXT USING "educationLevel"::TEXT;

UPDATE "jobs"
SET "educationLevel" = NULL
WHERE "educationLevel" = 'NONE';

UPDATE "user_profiles"
SET "educationLevel" = NULL
WHERE "educationLevel" = 'NONE';

UPDATE "jobs"
SET "educationLevel" = 'INTERMEDIATE'
WHERE "educationLevel" = 'HIGH_SCHOOL';

UPDATE "user_profiles"
SET "educationLevel" = 'INTERMEDIATE'
WHERE "educationLevel" = 'HIGH_SCHOOL';

DROP TYPE IF EXISTS "EducationLevel";
CREATE TYPE "EducationLevel" AS ENUM (
  'TRAINING_CENTER',
  'INTERMEDIATE',
  'COLLEGE',
  'BACHELOR',
  'MASTER',
  'PHD'
);

ALTER TABLE "jobs"
  ALTER COLUMN "educationLevel" TYPE "EducationLevel"
  USING CASE
    WHEN "educationLevel" IS NULL THEN NULL
    ELSE "educationLevel"::"EducationLevel"
  END;

ALTER TABLE "user_profiles"
  ALTER COLUMN "educationLevel" TYPE "EducationLevel"
  USING CASE
    WHEN "educationLevel" IS NULL THEN NULL
    ELSE "educationLevel"::"EducationLevel"
  END;

-- 5) Keep index state aligned with staging baseline.
-- Intentionally do not create user_profiles_* indexes in this hotfix.
