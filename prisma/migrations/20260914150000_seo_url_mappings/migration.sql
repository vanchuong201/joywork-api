-- Dọn tàn dư của bản thử nghiệm job_seo_landing_pages (bảng rỗng, không còn code dùng)
DROP TABLE IF EXISTS "job_seo_landing_pages";
DROP TYPE IF EXISTS "JobSeoLandingStatus";

-- CreateEnum
CREATE TYPE "SeoUrlMappingStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SeoDestinationType" AS ENUM ('JOB_SEARCH');

-- CreateTable
CREATE TABLE "seo_url_mappings" (
    "id" TEXT NOT NULL,
    "seoPath" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "heading" TEXT,
    "originalPath" TEXT NOT NULL,
    "destinationType" "SeoDestinationType" NOT NULL,
    "destinationParams" JSONB NOT NULL,
    "destinationKey" TEXT NOT NULL,
    "isCanonical" BOOLEAN NOT NULL DEFAULT false,
    "status" "SeoUrlMappingStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seo_url_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seo_url_mappings_seoPath_key" ON "seo_url_mappings"("seoPath");

-- CreateIndex
CREATE INDEX "seo_url_mappings_destinationKey_status_idx" ON "seo_url_mappings"("destinationKey", "status");

-- CreateIndex
CREATE INDEX "seo_url_mappings_destinationKey_isCanonical_idx" ON "seo_url_mappings"("destinationKey", "isCanonical");

-- CreateIndex
CREATE INDEX "seo_url_mappings_status_updatedAt_idx" ON "seo_url_mappings"("status", "updatedAt");
