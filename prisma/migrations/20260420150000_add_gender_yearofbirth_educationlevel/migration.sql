-- Create Gender enum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- Add Gender enum values to existing EducationLevel (PostgreSQL requires ALTER TYPE)
DO $$ BEGIN
    ALTER TYPE "EducationLevel" ADD VALUE ('TRAINING_CENTER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add new columns to user_profiles
ALTER TABLE "user_profiles" ADD COLUMN "gender" "Gender" DEFAULT 'MALE';
ALTER TABLE "user_profiles" ADD COLUMN "yearOfBirth" INTEGER;
ALTER TABLE "user_profiles" ADD COLUMN "educationLevel" "EducationLevel";

-- Create index for filtering
CREATE INDEX "user_profiles_gender_idx" ON "user_profiles"("gender");
CREATE INDEX "user_profiles_yearOfBirth_idx" ON "user_profiles"("yearOfBirth");
CREATE INDEX "user_profiles_educationLevel_idx" ON "user_profiles"("educationLevel");
