-- CreateTable
CREATE TABLE "company_profiles" (
    "companyId" TEXT NOT NULL,
    "stats" JSONB,
    "vision" TEXT,
    "mission" TEXT,
    "coreValues" TEXT,
    "leadershipPhilosophy" JSONB,
    "products" JSONB,
    "recruitmentPrinciples" JSONB,
    "benefits" JSONB,
    "hrJourney" JSONB,
    "careerPath" JSONB,
    "salaryAndBonus" JSONB,
    "training" JSONB,
    "leaders" JSONB,
    "story" JSONB,
    "culture" JSONB,
    "awards" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_profiles_pkey" PRIMARY KEY ("companyId")
);

-- AddForeignKey
ALTER TABLE "company_profiles" ADD CONSTRAINT "company_profiles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
