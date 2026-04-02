-- Refactor: replace expectedSalary string with structured salary range on user_profiles
ALTER TABLE "user_profiles"
  DROP COLUMN IF EXISTS "expectedSalary",
  ADD COLUMN IF NOT EXISTS "expectedSalaryMin" INTEGER,
  ADD COLUMN IF NOT EXISTS "expectedSalaryMax" INTEGER,
  ADD COLUMN IF NOT EXISTS "salaryCurrency"    TEXT DEFAULT 'VND';

-- Refactor: replace CompanySize enum with free-form string on companies
ALTER TABLE "companies"
  ALTER COLUMN "size" TYPE TEXT USING "size"::TEXT;

-- Drop the old CompanySize enum (no longer referenced in schema)
DROP TYPE IF EXISTS "CompanySize";
