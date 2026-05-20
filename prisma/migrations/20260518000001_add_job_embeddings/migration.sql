ALTER TABLE "jobs" ADD COLUMN "embedding" vector(1536);

CREATE INDEX "jobs_embedding_idx"
  ON "jobs" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
