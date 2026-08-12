-- New profiles default to opt-in contact reveal OFF.
-- Existing rows keep their current allowCvFlip values.
ALTER TABLE "user_profiles" ALTER COLUMN "allowCvFlip" SET DEFAULT false;
