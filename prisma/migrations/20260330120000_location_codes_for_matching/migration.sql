-- Add canonical location codes array for matching
ALTER TABLE "user_profiles"
ADD COLUMN IF NOT EXISTS "locations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "jobs"
ADD COLUMN IF NOT EXISTS "locations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill from legacy single-location columns before dropping them
UPDATE "user_profiles"
SET "locations" = CASE
  WHEN "location" IS NULL OR btrim("location") = '' THEN ARRAY[]::TEXT[]
  ELSE ARRAY["location"]
END;

UPDATE "jobs"
SET "locations" = CASE
  WHEN "location" IS NULL OR btrim("location") = '' THEN ARRAY[]::TEXT[]
  ELSE ARRAY["location"]
END;

-- Remove legacy columns
ALTER TABLE "user_profiles" DROP COLUMN IF EXISTS "location";
ALTER TABLE "jobs" DROP COLUMN IF EXISTS "location";
