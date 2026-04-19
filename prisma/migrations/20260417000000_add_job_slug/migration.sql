-- AddSlug
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "slug" TEXT;
CREATE INDEX IF NOT EXISTS "jobs_slug_idx" ON "jobs"("slug");
