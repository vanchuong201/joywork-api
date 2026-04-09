-- CreateEnum
CREATE TYPE "CourseVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "CourseVideoSource" AS ENUM ('URL', 'S3_KEY');

-- CreateEnum
CREATE TYPE "CourseAttachmentSource" AS ENUM ('URL', 'S3_KEY');

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "description" TEXT,
    "thumbnailUrl" TEXT,
    "visibility" "CourseVisibility" NOT NULL DEFAULT 'PUBLIC',
    "status" "CourseStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_lessons" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_lesson_videos" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "source" "CourseVideoSource" NOT NULL,
    "value" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_lesson_videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_lesson_attachments" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" "CourseAttachmentSource" NOT NULL,
    "value" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_lesson_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_enrollments" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "courses_slug_key" ON "courses"("slug");

-- CreateIndex
CREATE INDEX "courses_status_visibility_idx" ON "courses"("status", "visibility");

-- CreateIndex
CREATE INDEX "courses_slug_idx" ON "courses"("slug");

-- CreateIndex
CREATE INDEX "course_lessons_courseId_idx" ON "course_lessons"("courseId");

-- CreateIndex
CREATE INDEX "course_lessons_courseId_sortOrder_idx" ON "course_lessons"("courseId", "sortOrder");

-- CreateIndex
CREATE INDEX "course_lesson_videos_lessonId_idx" ON "course_lesson_videos"("lessonId");

-- CreateIndex
CREATE INDEX "course_lesson_videos_lessonId_sortOrder_idx" ON "course_lesson_videos"("lessonId", "sortOrder");

-- CreateIndex
CREATE INDEX "course_lesson_attachments_lessonId_idx" ON "course_lesson_attachments"("lessonId");

-- CreateIndex
CREATE INDEX "course_lesson_attachments_lessonId_sortOrder_idx" ON "course_lesson_attachments"("lessonId", "sortOrder");

-- CreateIndex
CREATE INDEX "course_enrollments_userId_idx" ON "course_enrollments"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "course_enrollments_courseId_userId_key" ON "course_enrollments"("courseId", "userId");

-- AddForeignKey
ALTER TABLE "course_lessons" ADD CONSTRAINT "course_lessons_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_lesson_videos" ADD CONSTRAINT "course_lesson_videos_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "course_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_lesson_attachments" ADD CONSTRAINT "course_lesson_attachments_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "course_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
