-- CreateEnum
CREATE TYPE "CandidateImportRecordStatus" AS ENUM ('CREATED', 'SKIPPED_EXISTING', 'FAILED');

-- CreateEnum
CREATE TYPE "CandidateCvLinkType" AS ENUM ('DRIVE_FILE', 'DRIVE_DOC', 'CANVA', 'LINKEDIN', 'FOLDER', 'OTHER', 'EMPTY');

-- CreateTable
CREATE TABLE "candidate_import_batches" (
    "id" TEXT NOT NULL,
    "createdByAdminId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "created" INTEGER NOT NULL,
    "skipped" INTEGER NOT NULL,
    "failed" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_import_records" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "rawName" TEXT,
    "rawPhone" TEXT,
    "rawProvince" TEXT,
    "rawDistrict" TEXT,
    "rawPosition" TEXT,
    "rawSalary" TEXT,
    "rawExperience" TEXT,
    "rawSocialLink" TEXT,
    "rawCvLink" TEXT,
    "rawPortfolioLink" TEXT,
    "cvLinkType" "CandidateCvLinkType" NOT NULL DEFAULT 'EMPTY',
    "status" "CandidateImportRecordStatus" NOT NULL,
    "error" TEXT,
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_import_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "batchId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "candidate_import_batches_createdByAdminId_idx" ON "candidate_import_batches"("createdByAdminId");

-- CreateIndex
CREATE INDEX "candidate_import_records_batchId_idx" ON "candidate_import_records"("batchId");

-- CreateIndex
CREATE INDEX "candidate_import_records_email_idx" ON "candidate_import_records"("email");

-- CreateIndex
CREATE INDEX "candidate_import_records_userId_idx" ON "candidate_import_records"("userId");

-- CreateIndex
CREATE INDEX "candidate_import_records_status_idx" ON "candidate_import_records"("status");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_tokens_tokenHash_key" ON "onboarding_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "onboarding_tokens_userId_idx" ON "onboarding_tokens"("userId");

-- CreateIndex
CREATE INDEX "onboarding_tokens_batchId_idx" ON "onboarding_tokens"("batchId");

-- CreateIndex
CREATE INDEX "onboarding_tokens_expiresAt_idx" ON "onboarding_tokens"("expiresAt");

-- AddForeignKey
ALTER TABLE "candidate_import_batches" ADD CONSTRAINT "candidate_import_batches_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_import_records" ADD CONSTRAINT "candidate_import_records_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "candidate_import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_import_records" ADD CONSTRAINT "candidate_import_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_tokens" ADD CONSTRAINT "onboarding_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_tokens" ADD CONSTRAINT "onboarding_tokens_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "candidate_import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
