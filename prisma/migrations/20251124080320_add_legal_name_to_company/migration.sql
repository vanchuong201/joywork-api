-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "legalName" TEXT;

-- AlterTable
ALTER TABLE "company_ticket_messages" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "company_tickets" ALTER COLUMN "updatedAt" DROP DEFAULT;
