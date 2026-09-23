-- CreateTable
CREATE TABLE "cv_active_daily_snapshots" (
    "id" TEXT NOT NULL,
    "periodDate" DATE NOT NULL,
    "count" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cv_active_daily_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cv_active_daily_snapshots_periodDate_key" ON "cv_active_daily_snapshots"("periodDate");
