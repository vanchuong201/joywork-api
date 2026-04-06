ALTER TABLE "posts"
ADD COLUMN "deletedByJoyworkAt" TIMESTAMP(3),
ADD COLUMN "deletedByJoyworkReason" TEXT;
