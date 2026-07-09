-- Backfill existing profiles without status
UPDATE "user_profiles"
SET "status" = 'OPEN_TO_WORK'
WHERE "status" IS NULL;

-- Default new profiles to actively looking
ALTER TABLE "user_profiles"
ALTER COLUMN "status" SET DEFAULT 'OPEN_TO_WORK';
