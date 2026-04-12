-- AlterTable
ALTER TABLE "user_profiles"
ADD COLUMN "allowCvFlip" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "isSearchingJob" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "company_feature_entitlements"
ADD COLUMN "metadata" JSONB;

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CV_FLIP_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CV_FLIP_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CV_FLIP_REJECTED';

-- CreateEnum
CREATE TYPE "CvFlipRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "cv_flip_connections" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "flippedById" TEXT NOT NULL,
    "flippedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cv_flip_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cv_flip_requests" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "status" "CvFlipRequestStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "cv_flip_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cv_flip_usages" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "requestCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cv_flip_usages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cv_flip_connections_companyId_userId_key" ON "cv_flip_connections"("companyId", "userId");

-- CreateIndex
CREATE INDEX "cv_flip_connections_companyId_idx" ON "cv_flip_connections"("companyId");

-- CreateIndex
CREATE INDEX "cv_flip_connections_userId_idx" ON "cv_flip_connections"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "cv_flip_requests_companyId_userId_key" ON "cv_flip_requests"("companyId", "userId");

-- CreateIndex
CREATE INDEX "cv_flip_requests_companyId_status_idx" ON "cv_flip_requests"("companyId", "status");

-- CreateIndex
CREATE INDEX "cv_flip_requests_userId_status_idx" ON "cv_flip_requests"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "cv_flip_usages_companyId_month_year_key" ON "cv_flip_usages"("companyId", "month", "year");

-- AddForeignKey
ALTER TABLE "cv_flip_connections" ADD CONSTRAINT "cv_flip_connections_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cv_flip_connections" ADD CONSTRAINT "cv_flip_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cv_flip_connections" ADD CONSTRAINT "cv_flip_connections_flippedById_fkey" FOREIGN KEY ("flippedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cv_flip_requests" ADD CONSTRAINT "cv_flip_requests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cv_flip_requests" ADD CONSTRAINT "cv_flip_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cv_flip_requests" ADD CONSTRAINT "cv_flip_requests_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cv_flip_usages" ADD CONSTRAINT "cv_flip_usages_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
