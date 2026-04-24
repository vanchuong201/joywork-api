-- Add gender column to jobs table (schema has it but migration was missing)
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "gender" "Gender";
