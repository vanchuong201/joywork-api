-- CreateEnum (idempotent)
DO $$ BEGIN
    CREATE TYPE "CompanyStatementStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "CompanyStatementAnswer" AS ENUM ('YES', 'NO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable company_statements (was missing; required for posts FK)
CREATE TABLE IF NOT EXISTS "company_statements" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "status" "CompanyStatementStatus" NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable company_statement_recipients
CREATE TABLE IF NOT EXISTS "company_statement_recipients" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "answer" "CompanyStatementAnswer",
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "company_statement_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "company_statement_recipients_statementId_contactId_key" ON "company_statement_recipients"("statementId", "contactId");

-- AddForeignKey company_statements -> companies
ALTER TABLE "company_statements" DROP CONSTRAINT IF EXISTS "company_statements_companyId_fkey";
ALTER TABLE "company_statements" ADD CONSTRAINT "company_statements_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey company_statement_recipients
ALTER TABLE "company_statement_recipients" DROP CONSTRAINT IF EXISTS "company_statement_recipients_statementId_fkey";
ALTER TABLE "company_statement_recipients" ADD CONSTRAINT "company_statement_recipients_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "company_statements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_statement_recipients" DROP CONSTRAINT IF EXISTS "company_statement_recipients_contactId_fkey";
ALTER TABLE "company_statement_recipients" ADD CONSTRAINT "company_statement_recipients_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "company_verification_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable posts: add statementId and statementSnapshot
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "statementId" TEXT;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "statementSnapshot" JSONB;

-- AddForeignKey posts -> company_statements
ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "posts_statementId_fkey";
ALTER TABLE "posts" ADD CONSTRAINT "posts_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "company_statements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
