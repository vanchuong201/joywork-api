-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO');

-- AlterTable
ALTER TABLE "post_images" ADD COLUMN "type" "MediaType" NOT NULL DEFAULT 'IMAGE';
