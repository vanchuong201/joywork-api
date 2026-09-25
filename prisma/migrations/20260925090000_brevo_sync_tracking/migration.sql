-- AlterTable
ALTER TABLE "users" ADD COLUMN "brevoSyncedAt" TIMESTAMP(3),
ADD COLUMN "brevoSyncHash" TEXT;

-- CreateIndex
CREATE INDEX "users_brevoSyncedAt_idx" ON "users"("brevoSyncedAt");

-- CreateIndex
CREATE INDEX "users_brevoSyncHash_idx" ON "users"("brevoSyncHash");

-- CreateTable
CREATE TABLE "brevo_sync_runs" (
    "id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "contactsAttempted" INTEGER NOT NULL DEFAULT 0,
    "importOk" INTEGER NOT NULL DEFAULT 0,
    "importFailed" INTEGER NOT NULL DEFAULT 0,
    "attrChunksOk" INTEGER NOT NULL DEFAULT 0,
    "attrChunksFailed" INTEGER NOT NULL DEFAULT 0,
    "createdMissing" INTEGER NOT NULL DEFAULT 0,
    "skippedInvalidEmail" INTEGER NOT NULL DEFAULT 0,
    "cvActivateCount" INTEGER NOT NULL DEFAULT 0,
    "dirtySelected" INTEGER NOT NULL DEFAULT 0,
    "exitCode" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "brevo_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brevo_sync_failures" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brevo_sync_failures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "brevo_sync_runs_startedAt_idx" ON "brevo_sync_runs"("startedAt");

-- CreateIndex
CREATE INDEX "brevo_sync_failures_runId_idx" ON "brevo_sync_failures"("runId");

-- CreateIndex
CREATE INDEX "brevo_sync_failures_email_idx" ON "brevo_sync_failures"("email");

-- AddForeignKey
ALTER TABLE "brevo_sync_failures" ADD CONSTRAINT "brevo_sync_failures_runId_fkey" FOREIGN KEY ("runId") REFERENCES "brevo_sync_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
