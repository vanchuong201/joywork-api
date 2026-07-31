-- CreateEnum
CREATE TYPE "CompanyBadgeType" AS ENUM ('GOOD_COMPANY', 'BASIC_COMMITMENT');

-- CreateTable
CREATE TABLE "company_badges" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "CompanyBadgeType" NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedById" TEXT,
    "note" TEXT,

    CONSTRAINT "company_badges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_badges_companyId_type_key" ON "company_badges"("companyId", "type");

-- CreateIndex
CREATE INDEX "company_badges_type_idx" ON "company_badges"("type");

-- AddForeignKey
ALTER TABLE "company_badges" ADD CONSTRAINT "company_badges_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill from legacy company.isGood
INSERT INTO "company_badges" ("id", "companyId", "type")
SELECT
  md5(random()::text || clock_timestamp()::text || c."id"),
  c."id",
  'GOOD_COMPANY'::"CompanyBadgeType"
FROM "companies" c
WHERE c."isGood" = true;
