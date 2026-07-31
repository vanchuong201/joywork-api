-- Drop legacy column after migrating to company_badges
ALTER TABLE "companies" DROP COLUMN "isGood";
