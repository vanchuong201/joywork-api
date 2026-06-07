-- Add isGood flag for admin Good Company toggle
ALTER TABLE "companies"
ADD COLUMN "isGood" BOOLEAN NOT NULL DEFAULT false;
