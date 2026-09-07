ALTER TABLE "cv_flip_requests"
ADD COLUMN "jobId" TEXT,
ADD COLUMN "message" VARCHAR(500);

CREATE INDEX "cv_flip_requests_jobId_idx" ON "cv_flip_requests"("jobId");

ALTER TABLE "cv_flip_requests"
ADD CONSTRAINT "cv_flip_requests_jobId_fkey"
FOREIGN KEY ("jobId") REFERENCES "jobs"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
