-- Add working time fields to jobs table
-- workingTimeRanges: JSONB array of { dayFrom, dayTo, timeStart, timeEnd }
-- workingTimeNote: free-form note for working time
-- worksOnSaturday: derived flag for advanced filter (NULL = unspecified, TRUE = works Saturday, FALSE = rests Saturday)
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "workingTimeRanges" JSONB;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "workingTimeNote" TEXT;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "worksOnSaturday" BOOLEAN;

CREATE INDEX IF NOT EXISTS "jobs_worksOnSaturday_idx" ON "jobs" ("worksOnSaturday");
