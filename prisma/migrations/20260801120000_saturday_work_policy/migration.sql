-- CreateEnum
CREATE TYPE "SaturdayWorkPolicy" AS ENUM ('NO', 'FLEXIBLE', 'FIXED');

-- AlterTable: boolean -> SaturdayWorkPolicy (true->FIXED, false->NO, null->null)
ALTER TABLE "jobs"
  ALTER COLUMN "worksOnSaturday" TYPE "SaturdayWorkPolicy"
  USING (
    CASE
      WHEN "worksOnSaturday" IS TRUE THEN 'FIXED'::"SaturdayWorkPolicy"
      WHEN "worksOnSaturday" IS FALSE THEN 'NO'::"SaturdayWorkPolicy"
      ELSE NULL
    END
  );
