-- DropIndex
DROP INDEX "applications_userId_jobId_key";

-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "defaultCvId" TEXT;

-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "cvSnapshot" JSONB,
ADD COLUMN     "cvSnapshotVersion" INTEGER,
ADD COLUMN     "sourceCvId" TEXT;

-- CreateTable
CREATE TABLE "candidate_cvs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "avatar" TEXT,
    "headline" TEXT,
    "bio" TEXT,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cvUrl" TEXT,
    "locations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "wardCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "specificAddress" TEXT,
    "website" TEXT,
    "linkedin" TEXT,
    "github" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "fullName" TEXT,
    "title" TEXT,
    "visibility" JSONB,
    "knowledge" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "attitude" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expectedSalaryMin" BIGINT,
    "expectedSalaryMax" BIGINT,
    "salaryCurrency" TEXT DEFAULT 'VND',
    "workMode" TEXT,
    "expectedCulture" TEXT,
    "careerGoals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "gender" "Gender" DEFAULT 'MALE',
    "dayOfBirth" INTEGER,
    "monthOfBirth" INTEGER,
    "yearOfBirth" INTEGER,
    "educationLevel" "EducationLevel",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_cvs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_cv_experiences" (
    "id" TEXT NOT NULL,
    "cvId" TEXT NOT NULL,
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

    CONSTRAINT "candidate_cv_experiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_cv_educations" (
    "id" TEXT NOT NULL,
    "cvId" TEXT NOT NULL,
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

    CONSTRAINT "candidate_cv_educations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "candidate_cvs_userId_idx" ON "candidate_cvs"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_cvs_userId_nameNormalized_key" ON "candidate_cvs"("userId", "nameNormalized");

-- CreateIndex
CREATE INDEX "candidate_cv_experiences_cvId_idx" ON "candidate_cv_experiences"("cvId");

-- CreateIndex
CREATE INDEX "candidate_cv_experiences_company_idx" ON "candidate_cv_experiences"("company");

-- CreateIndex
CREATE INDEX "candidate_cv_educations_cvId_idx" ON "candidate_cv_educations"("cvId");

-- CreateIndex
CREATE INDEX "candidate_cv_educations_school_idx" ON "candidate_cv_educations"("school");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_defaultCvId_key" ON "user_profiles"("defaultCvId");

-- CreateIndex
CREATE INDEX "applications_userId_jobId_idx" ON "applications"("userId", "jobId");

-- CreateIndex
CREATE INDEX "applications_jobId_userId_status_idx" ON "applications"("jobId", "userId", "status");

-- CreateIndex
CREATE INDEX "applications_sourceCvId_idx" ON "applications"("sourceCvId");

-- DataCopy: mỗi user có profile hoặc có experience/education → 1 CV "CV của tôi"
INSERT INTO "candidate_cvs" (
    "id", "userId", "name", "nameNormalized",
    "avatar", "headline", "bio", "skills", "cvUrl", "locations", "wardCodes", "specificAddress",
    "website", "linkedin", "github", "contactEmail", "contactPhone", "fullName", "title", "visibility",
    "knowledge", "attitude", "expectedSalaryMin", "expectedSalaryMax", "salaryCurrency", "workMode",
    "expectedCulture", "careerGoals", "gender", "dayOfBirth", "monthOfBirth", "yearOfBirth", "educationLevel",
    "createdAt", "updatedAt"
)
SELECT
    'cv_' || u."userId", u."userId", 'CV của tôi', 'cv của tôi',
    p."avatar", p."headline", p."bio", COALESCE(p."skills", ARRAY[]::TEXT[]), p."cvUrl",
    COALESCE(p."locations", ARRAY[]::TEXT[]), COALESCE(p."wardCodes", ARRAY[]::TEXT[]), p."specificAddress",
    p."website", p."linkedin", p."github", p."contactEmail", p."contactPhone", p."fullName", p."title", p."visibility",
    COALESCE(p."knowledge", ARRAY[]::TEXT[]), COALESCE(p."attitude", ARRAY[]::TEXT[]),
    p."expectedSalaryMin", p."expectedSalaryMax", COALESCE(p."salaryCurrency", 'VND'), p."workMode",
    p."expectedCulture", COALESCE(p."careerGoals", ARRAY[]::TEXT[]), COALESCE(p."gender", 'MALE'),
    p."dayOfBirth", p."monthOfBirth", p."yearOfBirth", p."educationLevel",
    COALESCE(p."createdAt", CURRENT_TIMESTAMP), COALESCE(p."updatedAt", CURRENT_TIMESTAMP)
FROM (
    SELECT "userId" FROM "user_profiles"
    UNION
    SELECT "userId" FROM "user_experiences"
    UNION
    SELECT "userId" FROM "user_educations"
) u
JOIN "users" usr ON usr."id" = u."userId"
LEFT JOIN "user_profiles" p ON p."userId" = u."userId";

-- DataCopy: giữ nguyên id experience/education
INSERT INTO "candidate_cv_experiences" (
    "id", "cvId", "role", "company", "startDate", "endDate", "period", "desc", "achievements", "order", "createdAt", "updatedAt"
)
SELECT
    e."id", 'cv_' || e."userId", e."role", e."company", e."startDate", e."endDate", e."period", e."desc",
    e."achievements", e."order", e."createdAt", e."updatedAt"
FROM "user_experiences" e
JOIN "candidate_cvs" c ON c."id" = 'cv_' || e."userId";

INSERT INTO "candidate_cv_educations" (
    "id", "cvId", "school", "degree", "startDate", "endDate", "period", "gpa", "honors", "order", "createdAt", "updatedAt"
)
SELECT
    e."id", 'cv_' || e."userId", e."school", e."degree", e."startDate", e."endDate", e."period", e."gpa",
    e."honors", e."order", e."createdAt", e."updatedAt"
FROM "user_educations" e
JOIN "candidate_cvs" c ON c."id" = 'cv_' || e."userId";

-- DataCopy: user chỉ có experience/education (chưa có profile) → tạo profile để giữ CV mặc định
INSERT INTO "user_profiles" ("id", "userId", "skills", "createdAt", "updatedAt")
SELECT 'up_' || c."userId", c."userId", ARRAY[]::TEXT[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "candidate_cvs" c
LEFT JOIN "user_profiles" p ON p."userId" = c."userId"
WHERE p."id" IS NULL;

-- DataCopy: CV mặc định
UPDATE "user_profiles" p
SET "defaultCvId" = c."id"
FROM "candidate_cvs" c
WHERE c."id" = 'cv_' || p."userId";

-- DataCopy: đơn cũ gắn với CV vừa copy (rule apply lại theo CV; snapshot backfill bằng script sau deploy)
UPDATE "applications" a
SET "sourceCvId" = c."id"
FROM "candidate_cvs" c
WHERE c."id" = 'cv_' || a."userId"
  AND a."sourceCvId" IS NULL;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_defaultCvId_fkey" FOREIGN KEY ("defaultCvId") REFERENCES "candidate_cvs"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_cvs" ADD CONSTRAINT "candidate_cvs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_cv_experiences" ADD CONSTRAINT "candidate_cv_experiences_cvId_fkey" FOREIGN KEY ("cvId") REFERENCES "candidate_cvs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_cv_educations" ADD CONSTRAINT "candidate_cv_educations_cvId_fkey" FOREIGN KEY ("cvId") REFERENCES "candidate_cvs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_sourceCvId_fkey" FOREIGN KEY ("sourceCvId") REFERENCES "candidate_cvs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

