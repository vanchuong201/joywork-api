-- AlterTable
ALTER TABLE "posts"
ADD COLUMN "createdById" TEXT;

-- AlterTable
ALTER TABLE "post_images"
ADD COLUMN "storageKey" TEXT;

-- CreateTable
CREATE TABLE "post_audit_logs" (
    "id" TEXT NOT NULL,
    "postId" TEXT,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "post_audit_logs_postId_idx" ON "post_audit_logs"("postId");

-- CreateIndex
CREATE INDEX "post_audit_logs_actorId_idx" ON "post_audit_logs"("actorId");

-- AddForeignKey
ALTER TABLE "posts"
ADD CONSTRAINT "posts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_audit_logs"
ADD CONSTRAINT "post_audit_logs_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_audit_logs"
ADD CONSTRAINT "post_audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

