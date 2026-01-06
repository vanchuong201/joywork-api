-- CreateTable
CREATE TABLE IF NOT EXISTS "company_verification_contacts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_verification_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "company_verification_lists" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_verification_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "company_verification_list_items" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,

    CONSTRAINT "company_verification_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "company_verification_contacts_token_key" ON "company_verification_contacts"("token");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "company_verification_contacts_companyId_email_key" ON "company_verification_contacts"("companyId", "email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "company_verification_list_items_listId_contactId_key" ON "company_verification_list_items"("listId", "contactId");

-- AddForeignKey (with DO block to handle existing constraints)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'company_verification_contacts_companyId_fkey'
    ) THEN
        ALTER TABLE "company_verification_contacts" ADD CONSTRAINT "company_verification_contacts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'company_verification_lists_companyId_fkey'
    ) THEN
        ALTER TABLE "company_verification_lists" ADD CONSTRAINT "company_verification_lists_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'company_verification_list_items_listId_fkey'
    ) THEN
        ALTER TABLE "company_verification_list_items" ADD CONSTRAINT "company_verification_list_items_listId_fkey" FOREIGN KEY ("listId") REFERENCES "company_verification_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'company_verification_list_items_contactId_fkey'
    ) THEN
        ALTER TABLE "company_verification_list_items" ADD CONSTRAINT "company_verification_list_items_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "company_verification_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
