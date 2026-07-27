-- AlterEnum
DO $$ BEGIN
  ALTER TYPE "CandidateCvLinkType" ADD VALUE 'DIRECT_FILE';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "candidate_import_records" ADD COLUMN IF NOT EXISTS "emailSentAt" TIMESTAMP(3);
ALTER TABLE "candidate_import_records" ADD COLUMN IF NOT EXISTS "cvImportJobId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "candidate_import_records_cvImportJobId_idx" ON "candidate_import_records"("cvImportJobId");
