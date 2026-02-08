-- Update ExperienceLevel & JobLevel enums (breaking change)
-- Strategy: rename old enum types, create new enums, cast columns with mapping, then drop old types.

-- 1) ExperienceLevel
ALTER TYPE "ExperienceLevel" RENAME TO "ExperienceLevel_old";

CREATE TYPE "ExperienceLevel" AS ENUM (
  'NO_EXPERIENCE',
  'LT_1_YEAR',
  'Y1_2',
  'Y2_3',
  'Y3_5',
  'Y5_10',
  'GT_10'
);

ALTER TABLE "jobs" ALTER COLUMN "experienceLevel" DROP DEFAULT;

ALTER TABLE "jobs"
ALTER COLUMN "experienceLevel"
TYPE "ExperienceLevel"
USING (
  CASE "experienceLevel"::text
    WHEN 'ENTRY' THEN 'NO_EXPERIENCE'::"ExperienceLevel"
    WHEN 'JUNIOR' THEN 'Y1_2'::"ExperienceLevel"
    WHEN 'MID' THEN 'Y2_3'::"ExperienceLevel"
    WHEN 'SENIOR' THEN 'Y5_10'::"ExperienceLevel"
    WHEN 'LEAD' THEN 'Y5_10'::"ExperienceLevel"
    WHEN 'EXECUTIVE' THEN 'GT_10'::"ExperienceLevel"
    ELSE 'NO_EXPERIENCE'::"ExperienceLevel"
  END
);

ALTER TABLE "jobs" ALTER COLUMN "experienceLevel" SET DEFAULT 'NO_EXPERIENCE';

DROP TYPE "ExperienceLevel_old";

-- 2) JobLevel
ALTER TYPE "JobLevel" RENAME TO "JobLevel_old";

CREATE TYPE "JobLevel" AS ENUM (
  'INTERN_STUDENT',
  'FRESH_GRAD',
  'EMPLOYEE',
  'SPECIALIST_TEAM_LEAD',
  'MANAGER_HEAD',
  'DIRECTOR',
  'EXECUTIVE'
);

ALTER TABLE "jobs"
ALTER COLUMN "jobLevel"
TYPE "JobLevel"
USING (
  CASE
    WHEN "jobLevel" IS NULL THEN NULL
    WHEN "jobLevel"::text = 'STAFF' THEN 'EMPLOYEE'::"JobLevel"
    WHEN "jobLevel"::text = 'TEAM_LEAD' THEN 'SPECIALIST_TEAM_LEAD'::"JobLevel"
    WHEN "jobLevel"::text = 'SUPERVISOR' THEN 'MANAGER_HEAD'::"JobLevel"
    WHEN "jobLevel"::text = 'MANAGER' THEN 'MANAGER_HEAD'::"JobLevel"
    WHEN "jobLevel"::text = 'DIRECTOR' THEN 'DIRECTOR'::"JobLevel"
    WHEN "jobLevel"::text = 'EXECUTIVE' THEN 'EXECUTIVE'::"JobLevel"
    ELSE NULL
  END
);

DROP TYPE "JobLevel_old";

