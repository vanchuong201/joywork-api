-- AlterTable
ALTER TABLE "posts" ADD COLUMN "statementId" TEXT,
ADD COLUMN "statementSnapshot" JSONB;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "company_statements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
