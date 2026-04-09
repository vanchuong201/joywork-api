-- CreateEnum
CREATE TYPE "CompanyShowcaseListType" AS ENUM ('FEATURED', 'TOP');

-- CreateTable
CREATE TABLE "company_showcase_slots" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "listType" "CompanyShowcaseListType" NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "featuredCoverUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_showcase_slots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_showcase_slots_companyId_listType_key" ON "company_showcase_slots"("companyId", "listType");

CREATE INDEX "company_showcase_slots_listType_sortOrder_idx" ON "company_showcase_slots"("listType", "sortOrder");

ALTER TABLE "company_showcase_slots" ADD CONSTRAINT "company_showcase_slots_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Chuyển dữ liệu từ cột cũ trên companies (nếu có — tương thích DB đã từng có migration add_company_showcase_fields)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'companies'
      AND column_name = 'showcaseFeaturedOrder'
  ) THEN
    INSERT INTO "company_showcase_slots" ("id", "companyId", "listType", "sortOrder", "featuredCoverUrl", "createdAt", "updatedAt")
    SELECT
      gen_random_uuid()::text,
      c."id",
      'FEATURED'::"CompanyShowcaseListType",
      c."showcaseFeaturedOrder",
      c."showcaseFeaturedCoverUrl",
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    FROM "companies" c
    WHERE c."showcaseFeaturedOrder" IS NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'companies'
      AND column_name = 'showcaseTopOrder'
  ) THEN
    INSERT INTO "company_showcase_slots" ("id", "companyId", "listType", "sortOrder", "featuredCoverUrl", "createdAt", "updatedAt")
    SELECT
      gen_random_uuid()::text,
      c."id",
      'TOP'::"CompanyShowcaseListType",
      c."showcaseTopOrder",
      NULL,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    FROM "companies" c
    WHERE c."showcaseTopOrder" IS NOT NULL;
  END IF;
END $$;

-- Gỡ cột showcase khỏi companies (nếu vẫn còn)
ALTER TABLE "companies" DROP COLUMN IF EXISTS "showcaseFeaturedOrder",
DROP COLUMN IF EXISTS "showcaseFeaturedCoverUrl",
DROP COLUMN IF EXISTS "showcaseTopOrder";
