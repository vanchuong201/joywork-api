-- CreateTable
CREATE TABLE "province_registry" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "merged" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "province_registry_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "province_aliases" (
    "id" TEXT NOT NULL,
    "provinceCode" TEXT NOT NULL,
    "aliasText" TEXT NOT NULL,
    "aliasSlug" TEXT NOT NULL,
    "aliasType" TEXT NOT NULL DEFAULT 'MANUAL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "province_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "province_registry_region_idx" ON "province_registry"("region");

-- CreateIndex
CREATE INDEX "province_registry_isActive_idx" ON "province_registry"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "province_aliases_provinceCode_aliasSlug_key" ON "province_aliases"("provinceCode", "aliasSlug");

-- CreateIndex
CREATE INDEX "province_aliases_aliasSlug_isActive_idx" ON "province_aliases"("aliasSlug", "isActive");

-- CreateIndex
CREATE INDEX "province_aliases_provinceCode_idx" ON "province_aliases"("provinceCode");

-- AddForeignKey
ALTER TABLE "province_aliases" ADD CONSTRAINT "province_aliases_provinceCode_fkey" FOREIGN KEY ("provinceCode") REFERENCES "province_registry"("code") ON DELETE CASCADE ON UPDATE CASCADE;
