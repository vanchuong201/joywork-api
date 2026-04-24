import { randomBytes } from 'crypto';
import type {
  CourseAttachmentSource,
  CourseStatus,
  CourseVideoSource,
  CourseVisibility,
} from '@prisma/client';
import { prisma } from '@/shared/database/prisma';
import { AppError } from '@/shared/errors/errorHandler';
import { buildS3ObjectUrl, resolveReadableS3ObjectUrl } from '@/shared/storage/s3';
import { slugify } from '@/shared/slug';
import type { AdminCoursesQuery } from '@/modules/courses/course-admin.schema';
import {
  adminCourseCreateSchema,
  adminCoursePatchSchema,
  adminCourseEnrollmentCreateSchema,
  adminLessonCreateSchema,
  adminLessonPatchSchema,
  adminLessonVideoCreateSchema,
  adminLessonVideoPatchSchema,
  adminLessonAttachmentCreateSchema,
  adminLessonAttachmentPatchSchema,
  adminReorderLessonsSchema,
} from '@/modules/courses/course-admin.schema';
import type { z } from 'zod';

type CourseCreate = z.infer<typeof adminCourseCreateSchema>;
type CoursePatch = z.infer<typeof adminCoursePatchSchema>;
type EnrollmentCreate = z.infer<typeof adminCourseEnrollmentCreateSchema>;

function baseSlug(title: string): string {
  const s = slugify(title).slice(0, 80);
  return s || 'course';
}

async function allocateUniqueSlug(title: string, excludeCourseId?: string): Promise<string> {
  let slug = baseSlug(title);
  for (let i = 0; i < 12; i++) {
    const found = await prisma.course.findUnique({ where: { slug } });
    if (!found || (excludeCourseId && found.id === excludeCourseId)) {
      return slug;
    }
    slug = `${baseSlug(title)}-${randomBytes(3).toString('hex')}`;
  }
  throw new AppError('Không tạo được định danh khóa học', 500, 'SLUG_COLLISION');
}

function assertS3Key(value: string, sub: 'thumbnails' | 'videos' | 'attachments'): void {
  const prefix = `courses/${sub}/`;
  if (!value.startsWith(prefix)) {
    throw new AppError(`Key S3 phải bắt đầu bằng ${prefix}`, 400, 'INVALID_S3_KEY');
  }
}

export function normalizeAdminVideoInput(source: CourseVideoSource, value: string): string {
  if (source === 'S3_KEY') {
    assertS3Key(value, 'videos');
    return value;
  }
  return value.trim();
}

export function normalizeAdminAttachmentInput(
  source: CourseAttachmentSource,
  value: string,
): string {
  if (source === 'S3_KEY') {
    assertS3Key(value, 'attachments');
    return value;
  }
  return value.trim();
}

export async function normalizeThumbnailInput(url: string | null | undefined): Promise<string | null> {
  if (url == null || url === '') {
    return null;
  }
  const u = url.trim();
  if (u.includes('amazonaws.com/')) {
    const keyPart = u.split('.amazonaws.com/')[1]?.split('?')[0];
    if (keyPart?.startsWith('courses/thumbnails/')) {
      return buildS3ObjectUrl(keyPart);
    }
  }
  try {
    const parsed = new URL(u);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new AppError('Thumbnail URL không hợp lệ', 400, 'INVALID_URL');
    }
  } catch {
    throw new AppError('Thumbnail URL không hợp lệ', 400, 'INVALID_URL');
  }
  return u;
}

/** Giống catalog khóa học: bucket có thể private — trình duyệt cần URL GET có ký. */
const ADMIN_COURSE_THUMB_TTL_SEC = 3600;

const courseAdminInclude = {
  lessons: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      videos: { orderBy: { sortOrder: 'asc' as const } },
      attachments: { orderBy: { sortOrder: 'asc' as const } },
    },
  },
  enrollments: {
    select: {
      id: true,
      userId: true,
      createdAt: true,
      user: { select: { email: true, name: true } },
    },
  },
};

export class CourseAdminService {
  /** Trả về thumbnailUrl đọc được trong admin (presign nếu là object JoyWork S3). */
  private async withReadableCourseThumbnail<C extends { thumbnailUrl: string | null }>(course: C): Promise<C> {
    const thumbnailUrl = await resolveReadableS3ObjectUrl(course.thumbnailUrl, ADMIN_COURSE_THUMB_TTL_SEC);
    return { ...course, thumbnailUrl };
  }

  async listForAdmin(query: AdminCoursesQuery) {
    const { page, limit, q, status, visibility } = query;
    const where: {
      title?: { contains: string; mode: 'insensitive' };
      status?: CourseStatus;
      visibility?: CourseVisibility;
    } = {};
    if (q) {
      where.title = { contains: q, mode: 'insensitive' };
    }
    if (status) {
      where.status = status;
    }
    if (visibility) {
      where.visibility = visibility;
    }

    const [total, courses] = await prisma.$transaction([
      prisma.course.count({ where }),
      prisma.course.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          slug: true,
          shortDescription: true,
          thumbnailUrl: true,
          visibility: true,
          status: true,
          updatedAt: true,
          _count: { select: { lessons: true, enrollments: true } },
        },
      }),
    ]);

    const coursesReadable = await Promise.all(courses.map((c) => this.withReadableCourseThumbnail(c)));

    return {
      courses: coursesReadable,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async getOneForAdmin(courseId: string) {
    const course = await prisma.course.findFirst({
      where: { id: courseId },
      include: courseAdminInclude,
    });
    if (!course) {
      throw new AppError('Không tìm thấy khóa học', 404, 'COURSE_NOT_FOUND');
    }
    return this.withReadableCourseThumbnail(course);
  }

  async createCourse(input: CourseCreate) {
    const slug = await allocateUniqueSlug(input.title);
    const thumbnailUrl = await normalizeThumbnailInput(input.thumbnailUrl ?? null);

    const course = await prisma.course.create({
      data: {
        title: input.title.trim(),
        slug,
        shortDescription: input.shortDescription.trim(),
        description: input.description?.trim() ?? null,
        thumbnailUrl,
        visibility: input.visibility,
        status: input.status,
      },
      include: courseAdminInclude,
    });
    return this.withReadableCourseThumbnail(course);
  }

  async patchCourse(courseId: string, input: CoursePatch) {
    const existing = await prisma.course.findFirst({ where: { id: courseId } });
    if (!existing) {
      throw new AppError('Không tìm thấy khóa học', 404, 'COURSE_NOT_FOUND');
    }

    const nextTitle = input.title?.trim() ?? existing.title;
    let slug = existing.slug;
    if (input.title && input.title.trim() !== existing.title) {
      slug = await allocateUniqueSlug(nextTitle, existing.id);
    }

    const thumbnailUrl =
      input.thumbnailUrl !== undefined
        ? await normalizeThumbnailInput(input.thumbnailUrl)
        : existing.thumbnailUrl;

    const course = await prisma.course.update({
      where: { id: courseId },
      data: {
        ...(input.title !== undefined ? { title: nextTitle, slug } : {}),
        ...(input.shortDescription !== undefined
          ? { shortDescription: input.shortDescription.trim() }
          : {}),
        ...(input.description !== undefined
          ? { description: input.description?.trim() ?? null }
          : {}),
        ...(input.thumbnailUrl !== undefined ? { thumbnailUrl } : {}),
        ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      include: courseAdminInclude,
    });
    return this.withReadableCourseThumbnail(course);
  }

  async deleteCourse(courseId: string) {
    const existing = await prisma.course.findFirst({ where: { id: courseId } });
    if (!existing) {
      throw new AppError('Không tìm thấy khóa học', 404, 'COURSE_NOT_FOUND');
    }
    await prisma.course.delete({ where: { id: courseId } });
    return { ok: true };
  }

  async createLesson(courseId: string, input: z.infer<typeof adminLessonCreateSchema>) {
    await this.assertCourse(courseId);
    const max = await prisma.lesson.aggregate({
      where: { courseId },
      _max: { sortOrder: true },
    });
    const sortOrder = input.sortOrder ?? (max._max.sortOrder ?? -1) + 1;
    return prisma.lesson.create({
      data: {
        courseId,
        title: input.title.trim(),
        sortOrder,
      },
    });
  }

  async patchLesson(courseId: string, lessonId: string, input: z.infer<typeof adminLessonPatchSchema>) {
    const lesson = await prisma.lesson.findFirst({ where: { id: lessonId, courseId } });
    if (!lesson) {
      throw new AppError('Không tìm thấy bài học', 404, 'LESSON_NOT_FOUND');
    }
    return prisma.lesson.update({
      where: { id: lessonId },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
    });
  }

  async deleteLesson(courseId: string, lessonId: string) {
    const lesson = await prisma.lesson.findFirst({ where: { id: lessonId, courseId } });
    if (!lesson) {
      throw new AppError('Không tìm thấy bài học', 404, 'LESSON_NOT_FOUND');
    }
    await prisma.lesson.delete({ where: { id: lessonId } });
    return { ok: true };
  }

  async createVideo(courseId: string, lessonId: string, input: z.infer<typeof adminLessonVideoCreateSchema>) {
    await this.assertLesson(courseId, lessonId);
    const max = await prisma.lessonVideo.aggregate({
      where: { lessonId },
      _max: { sortOrder: true },
    });
    const sortOrder = input.sortOrder ?? (max._max.sortOrder ?? -1) + 1;
    const value = normalizeAdminVideoInput(input.source, input.value);
    return prisma.lessonVideo.create({
      data: {
        lessonId,
        source: input.source,
        value,
        sortOrder,
      },
    });
  }

  async patchVideo(
    courseId: string,
    lessonId: string,
    videoId: string,
    input: z.infer<typeof adminLessonVideoPatchSchema>,
  ) {
    await this.assertLesson(courseId, lessonId);
    const v = await prisma.lessonVideo.findFirst({ where: { id: videoId, lessonId } });
    if (!v) {
      throw new AppError('Không tìm thấy video', 404, 'VIDEO_NOT_FOUND');
    }
    const nextSource = input.source ?? v.source;
    const nextValueRaw = input.value ?? v.value;
    const value = normalizeAdminVideoInput(nextSource, nextValueRaw);
    return prisma.lessonVideo.update({
      where: { id: videoId },
      data: {
        ...(input.source !== undefined ? { source: input.source } : {}),
        ...(input.value !== undefined || input.source !== undefined ? { value } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
    });
  }

  async deleteVideo(courseId: string, lessonId: string, videoId: string) {
    await this.assertLesson(courseId, lessonId);
    const v = await prisma.lessonVideo.findFirst({ where: { id: videoId, lessonId } });
    if (!v) {
      throw new AppError('Không tìm thấy video', 404, 'VIDEO_NOT_FOUND');
    }
    await prisma.lessonVideo.delete({ where: { id: videoId } });
    return { ok: true };
  }

  async createAttachment(
    courseId: string,
    lessonId: string,
    input: z.infer<typeof adminLessonAttachmentCreateSchema>,
  ) {
    await this.assertLesson(courseId, lessonId);
    const max = await prisma.lessonAttachment.aggregate({
      where: { lessonId },
      _max: { sortOrder: true },
    });
    const sortOrder = input.sortOrder ?? (max._max.sortOrder ?? -1) + 1;
    const value = normalizeAdminAttachmentInput(input.source, input.value);
    return prisma.lessonAttachment.create({
      data: {
        lessonId,
        name: input.name.trim(),
        source: input.source,
        value,
        sortOrder,
      },
    });
  }

  async patchAttachment(
    courseId: string,
    lessonId: string,
    attachmentId: string,
    input: z.infer<typeof adminLessonAttachmentPatchSchema>,
  ) {
    await this.assertLesson(courseId, lessonId);
    const a = await prisma.lessonAttachment.findFirst({
      where: { id: attachmentId, lessonId },
    });
    if (!a) {
      throw new AppError('Không tìm thấy tệp đính kèm', 404, 'ATTACHMENT_NOT_FOUND');
    }
    const nextSource = input.source ?? a.source;
    const nextValRaw = input.value ?? a.value;
    const value =
      input.value !== undefined || input.source !== undefined
        ? normalizeAdminAttachmentInput(nextSource, nextValRaw)
        : a.value;
    return prisma.lessonAttachment.update({
      where: { id: attachmentId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.source !== undefined ? { source: input.source } : {}),
        ...(input.value !== undefined || input.source !== undefined ? { value } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
    });
  }

  async deleteAttachment(courseId: string, lessonId: string, attachmentId: string) {
    await this.assertLesson(courseId, lessonId);
    const a = await prisma.lessonAttachment.findFirst({
      where: { id: attachmentId, lessonId },
    });
    if (!a) {
      throw new AppError('Không tìm thấy tệp đính kèm', 404, 'ATTACHMENT_NOT_FOUND');
    }
    await prisma.lessonAttachment.delete({ where: { id: attachmentId } });
    return { ok: true };
  }

  async reorderLessons(courseId: string, input: z.infer<typeof adminReorderLessonsSchema>) {
    await this.assertCourse(courseId);
    const lessons = await prisma.lesson.findMany({
      where: { courseId },
      select: { id: true },
    });
    const setIds = new Set(lessons.map((l) => l.id));
    if (input.lessonIds.length !== setIds.size) {
      throw new AppError('Danh sách bài học không khớp', 400, 'LESSON_REORDER_INVALID');
    }
    for (const id of input.lessonIds) {
      if (!setIds.has(id)) {
        throw new AppError('Danh sách bài học không khớp', 400, 'LESSON_REORDER_INVALID');
      }
    }
    await prisma.$transaction(
      input.lessonIds.map((id, idx) =>
        prisma.lesson.update({
          where: { id },
          data: { sortOrder: idx },
        }),
      ),
    );
    return this.getOneForAdmin(courseId);
  }

  async listEnrollments(courseId: string) {
    await this.assertCourse(courseId);
    return prisma.courseEnrollment.findMany({
      where: { courseId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });
  }

  async addEnrollment(courseId: string, input: EnrollmentCreate) {
    const course = await this.assertCourse(courseId);
    if (course.visibility !== 'PRIVATE') {
      throw new AppError('Chỉ khóa PRIVATE mới cấp danh sách học viên', 400, 'ENROLLMENT_NOT_PRIVATE');
    }
    const user = await prisma.user.findUnique({
      where: { email: input.email.trim().toLowerCase() },
      select: { id: true },
    });
    if (!user) {
      throw new AppError('Không tìm thấy người dùng', 404, 'USER_NOT_FOUND');
    }
    const row = await prisma.courseEnrollment.upsert({
      where: {
        courseId_userId: { courseId, userId: user.id },
      },
      create: { courseId, userId: user.id },
      update: {},
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });
    return row;
  }

  async removeEnrollment(courseId: string, enrollmentId: string) {
    const row = await prisma.courseEnrollment.findFirst({
      where: { id: enrollmentId, courseId },
    });
    if (!row) {
      throw new AppError('Không tìm thấy học viên', 404, 'ENROLLMENT_NOT_FOUND');
    }
    await prisma.courseEnrollment.delete({ where: { id: enrollmentId } });
    return { ok: true };
  }

  private async assertCourse(courseId: string) {
    const course = await prisma.course.findFirst({ where: { id: courseId } });
    if (!course) {
      throw new AppError('Không tìm thấy khóa học', 404, 'COURSE_NOT_FOUND');
    }
    return course;
  }

  private async assertLesson(courseId: string, lessonId: string) {
    const lesson = await prisma.lesson.findFirst({ where: { id: lessonId, courseId } });
    if (!lesson) {
      throw new AppError('Không tìm thấy bài học', 404, 'LESSON_NOT_FOUND');
    }
    return lesson;
  }
}
