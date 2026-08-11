-- CreateTable
CREATE TABLE "banner_items" (
    "id" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "openInNewTab" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "banner_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "banner_items_slot_sortOrder_idx" ON "banner_items"("slot", "sortOrder");

-- CreateIndex
CREATE INDEX "banner_items_slot_isActive_idx" ON "banner_items"("slot", "isActive");
