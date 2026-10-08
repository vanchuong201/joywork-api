-- CreateEnum
CREATE TYPE "CompanyVisibilityStatus" AS ENUM ('ACTIVE', 'HIDDEN');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN "visibilityStatus" "CompanyVisibilityStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "companies" ADD COLUMN "hiddenAt" TIMESTAMP(3);
ALTER TABLE "companies" ADD COLUMN "hiddenById" TEXT;
ALTER TABLE "companies" ADD COLUMN "hiddenReason" TEXT;

-- CreateIndex
CREATE INDEX "companies_visibilityStatus_idx" ON "companies"("visibilityStatus");

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_hiddenById_fkey" FOREIGN KEY ("hiddenById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
