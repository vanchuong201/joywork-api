-- CreateEnumType (if not exists)
DO $$ BEGIN
 CREATE TYPE "JobLevel" AS ENUM('STAFF', 'TEAM_LEAD', 'SUPERVISOR', 'MANAGER', 'DIRECTOR', 'EXECUTIVE');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "EducationLevel" AS ENUM('NONE', 'HIGH_SCHOOL', 'COLLEGE', 'BACHELOR', 'MASTER', 'PHD');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "department" TEXT,
ADD COLUMN IF NOT EXISTS "jobLevel" "JobLevel",
ADD COLUMN IF NOT EXISTS "educationLevel" "EducationLevel";
