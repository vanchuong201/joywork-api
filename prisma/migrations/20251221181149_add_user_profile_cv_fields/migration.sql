-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('OPEN_TO_WORK', 'NOT_AVAILABLE', 'LOOKING');

-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "attitude" TEXT[],
ADD COLUMN     "careerGoals" TEXT[],
ADD COLUMN     "expectedCulture" TEXT,
ADD COLUMN     "expectedSalary" TEXT,
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "knowledge" TEXT[],
ADD COLUMN     "status" "UserStatus",
ADD COLUMN     "title" TEXT,
ADD COLUMN     "visibility" JSONB,
ADD COLUMN     "workMode" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "slug" TEXT;

-- CreateTable
CREATE TABLE "user_experiences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "period" TEXT,
    "desc" TEXT,
    "achievements" TEXT[],
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_experiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_educations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "school" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "period" TEXT,
    "gpa" TEXT,
    "honors" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_educations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_experiences_userId_idx" ON "user_experiences"("userId");

-- CreateIndex
CREATE INDEX "user_experiences_company_idx" ON "user_experiences"("company");

-- CreateIndex
CREATE INDEX "user_educations_userId_idx" ON "user_educations"("userId");

-- CreateIndex
CREATE INDEX "user_educations_school_idx" ON "user_educations"("school");

-- CreateIndex
CREATE UNIQUE INDEX "users_slug_key" ON "users"("slug");

-- CreateIndex
CREATE INDEX "users_slug_idx" ON "users"("slug");

-- AddForeignKey
ALTER TABLE "user_experiences" ADD CONSTRAINT "user_experiences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_educations" ADD CONSTRAINT "user_educations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
