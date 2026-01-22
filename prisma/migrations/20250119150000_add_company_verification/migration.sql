-- Add CompanyVerificationStatus enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CompanyVerificationStatus') THEN
    CREATE TYPE "CompanyVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');
  END IF;
END$$;

-- Add verification columns to companies table
ALTER TABLE "companies"
  ADD COLUMN IF NOT EXISTS "verificationStatus" "CompanyVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
  ADD COLUMN IF NOT EXISTS "verificationFileKey" TEXT,
  ADD COLUMN IF NOT EXISTS "verificationFileUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "verificationSubmittedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "verificationReviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "verificationReviewedById" TEXT,
  ADD COLUMN IF NOT EXISTS "verificationRejectReason" TEXT;
