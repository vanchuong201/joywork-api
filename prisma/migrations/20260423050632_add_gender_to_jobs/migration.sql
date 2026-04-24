-- Add gender column to jobs table (schema has it but migration was missing)
-- Gender enum was created in migration 20260420150000 for user_profiles, reuse it here
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "gender" "Gender";
