-- CreateEnum
CREATE TYPE "ReactionType" AS ENUM ('JOY', 'TRUST', 'SKEPTIC');

-- CreateTable
CREATE TABLE "post_reactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "type" "ReactionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "post_reactions_postId_idx" ON "post_reactions"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "post_reactions_userId_postId_key" ON "post_reactions"("userId", "postId");

-- AddForeignKey
ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
