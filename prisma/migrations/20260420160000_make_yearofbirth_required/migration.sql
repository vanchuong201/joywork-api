-- Make yearOfBirth NOT NULL with default value for existing records
-- Use current year minus 25 as reasonable default for existing users
UPDATE "user_profiles" SET "yearOfBirth" = EXTRACT(YEAR FROM CURRENT_DATE) - 25 WHERE "yearOfBirth" IS NULL;

-- Add NOT NULL constraint
ALTER TABLE "user_profiles" ALTER COLUMN "yearOfBirth" SET NOT NULL;
