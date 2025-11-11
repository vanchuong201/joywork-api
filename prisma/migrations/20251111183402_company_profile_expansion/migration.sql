/*
  Warnings:

  - Changed the type of `action` on the `post_audit_logs` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "PostAuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'PUBLISH', 'UNPUBLISH');

-- DropIndex
DROP INDEX "public"."post_audit_logs_actorId_idx";

-- DropIndex
DROP INDEX "public"."post_audit_logs_postId_idx";

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "headcount" INTEGER,
ADD COLUMN     "headcountNote" TEXT,
ADD COLUMN     "highlights" JSONB,
ADD COLUMN     "metrics" JSONB,
ADD COLUMN     "profileStory" JSONB;

-- AlterTable
ALTER TABLE "post_audit_logs" DROP COLUMN "action",
ADD COLUMN     "action" "PostAuditAction" NOT NULL;
