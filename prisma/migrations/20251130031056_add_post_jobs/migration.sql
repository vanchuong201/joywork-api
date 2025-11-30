-- CreateTable
CREATE TABLE "post_jobs" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "post_jobs_jobId_idx" ON "post_jobs"("jobId");

-- CreateIndex
CREATE INDEX "post_jobs_postId_idx" ON "post_jobs"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "post_jobs_postId_jobId_key" ON "post_jobs"("postId", "jobId");

-- AddForeignKey
ALTER TABLE "post_jobs" ADD CONSTRAINT "post_jobs_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_jobs" ADD CONSTRAINT "post_jobs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
