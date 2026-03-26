-- CreateEnum
CREATE TYPE "TalentPoolMemberStatus" AS ENUM ('ACTIVE', 'REMOVED');

-- CreateEnum
CREATE TYPE "TalentPoolRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TalentPoolRequestSource" AS ENUM ('SELF_REQUEST', 'ADMIN_ADD');

-- CreateEnum
CREATE TYPE "TalentPoolLogAction" AS ENUM ('REQUEST_CREATED', 'REQUEST_APPROVED', 'REQUEST_REJECTED', 'ADMIN_ADDED', 'MEMBER_REMOVED');

-- CreateTable
CREATE TABLE "talent_pool_members" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "TalentPoolMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" "TalentPoolRequestSource" NOT NULL,
    "addedById" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "talent_pool_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_pool_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "TalentPoolRequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "reason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "talent_pool_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_pool_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" "TalentPoolLogAction" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "talent_pool_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_feature_entitlements" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_feature_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "talent_pool_members_userId_key" ON "talent_pool_members"("userId");

-- CreateIndex
CREATE INDEX "talent_pool_requests_userId_idx" ON "talent_pool_requests"("userId");

-- CreateIndex
CREATE INDEX "talent_pool_requests_status_idx" ON "talent_pool_requests"("status");

-- CreateIndex
CREATE INDEX "talent_pool_logs_userId_idx" ON "talent_pool_logs"("userId");

-- CreateIndex
CREATE INDEX "company_feature_entitlements_companyId_idx" ON "company_feature_entitlements"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "company_feature_entitlements_companyId_featureKey_key" ON "company_feature_entitlements"("companyId", "featureKey");

-- AddForeignKey
ALTER TABLE "talent_pool_members" ADD CONSTRAINT "talent_pool_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_pool_members" ADD CONSTRAINT "talent_pool_members_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_pool_requests" ADD CONSTRAINT "talent_pool_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_pool_requests" ADD CONSTRAINT "talent_pool_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_pool_logs" ADD CONSTRAINT "talent_pool_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_pool_logs" ADD CONSTRAINT "talent_pool_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_feature_entitlements" ADD CONSTRAINT "company_feature_entitlements_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
