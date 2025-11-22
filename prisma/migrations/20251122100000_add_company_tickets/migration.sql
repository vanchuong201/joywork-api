-- Create TicketStatus enum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'RESPONDED', 'CLOSED');

-- Company tickets table
CREATE TABLE "company_tickets" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "applicantLastViewedAt" TIMESTAMP(3),
    "companyLastViewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "company_tickets_pkey" PRIMARY KEY ("id")
);

-- Ticket messages
CREATE TABLE "company_ticket_messages" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "company_ticket_messages_pkey" PRIMARY KEY ("id")
);

-- Indexes for faster lookups
CREATE INDEX "company_tickets_companyId_idx" ON "company_tickets"("companyId");
CREATE INDEX "company_tickets_applicantId_idx" ON "company_tickets"("applicantId");
CREATE INDEX "company_tickets_status_idx" ON "company_tickets"("status");
CREATE INDEX "company_ticket_messages_ticketId_idx" ON "company_ticket_messages"("ticketId");
CREATE INDEX "company_ticket_messages_senderId_idx" ON "company_ticket_messages"("senderId");

-- Foreign keys
ALTER TABLE "company_tickets"
  ADD CONSTRAINT "company_tickets_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_tickets"
  ADD CONSTRAINT "company_tickets_applicantId_fkey"
  FOREIGN KEY ("applicantId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_ticket_messages"
  ADD CONSTRAINT "company_ticket_messages_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "company_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_ticket_messages"
  ADD CONSTRAINT "company_ticket_messages_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

