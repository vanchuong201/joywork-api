-- CreateEnum
CREATE TYPE "CvImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED', 'APPLIED');

-- CreateTable
CREATE TABLE "cv_import_jobs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceCvUrl" TEXT,
    "sourceKey" TEXT,
    "fileName" TEXT,
    "fileType" TEXT,
    "status" "CvImportStatus" NOT NULL DEFAULT 'PENDING',
    "parsedData" JSONB,
    "warnings" JSONB,
    "confidence" DOUBLE PRECISION,
    "applyMode" TEXT,
    "appliedSections" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "snapshotBefore" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "cv_import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cv_import_jobs_userId_createdAt_idx" ON "cv_import_jobs"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "cv_import_jobs" ADD CONSTRAINT "cv_import_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
