-- CreateTable
CREATE TABLE "company_slug_redirects" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_slug_redirects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_slug_redirects_slug_key" ON "company_slug_redirects"("slug");

-- CreateIndex
CREATE INDEX "company_slug_redirects_companyId_idx" ON "company_slug_redirects"("companyId");

-- AddForeignKey
ALTER TABLE "company_slug_redirects" ADD CONSTRAINT "company_slug_redirects_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
