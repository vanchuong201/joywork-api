-- CreateTable
CREATE TABLE "ward_registry" (
    "code" TEXT NOT NULL,
    "provinceCode" TEXT NOT NULL,
    "officialCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fullName" TEXT,
    "unitType" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ward_registry_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE UNIQUE INDEX "ward_registry_provinceCode_officialCode_key" ON "ward_registry"("provinceCode", "officialCode");

-- CreateIndex
CREATE INDEX "ward_registry_provinceCode_idx" ON "ward_registry"("provinceCode");

-- AddForeignKey
ALTER TABLE "ward_registry" ADD CONSTRAINT "ward_registry_provinceCode_fkey" FOREIGN KEY ("provinceCode") REFERENCES "province_registry"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN "wardCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN "wardCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "companies" ADD COLUMN "wardCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];
