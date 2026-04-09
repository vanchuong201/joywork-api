import {
  CourseAttachmentSource,
  CourseStatus,
  CourseVideoSource,
  CourseVisibility,
} from '@prisma/client';
import { prisma } from '@/shared/database/prisma';
import { AppError } from '@/shared/errors/errorHandler';
import { createPresignedDownloadUrl, resolveReadableS3ObjectUrl } from '@/shared/storage/s3';
import type { CoursesListQuery } from '@/modules/courses/courses.schema';

const SIGNED_ASSET_TTL_SEC = 3600;

function canUnlockCourseContent(
  userId: string | undefined,
  visibility: CourseVisibility,
  isEnrolled: boolean,
): boolean {
  if (!userId) {
    return false;
  }
  if (visibility === 'PUBLIC') {
    return true;
  }
  return isEnrolled;
}

async function resolveThumbnailForClient(url: string | null | undefined): Promise<string | null> {
  if (!url) {
    return null;
  }
  return resolveReadableS3ObjectUrl(url, SIGNED_ASSET_TTL_SEC);
}

async function resolveVideoPlayback(
  source: CourseVideoSource,
  value: string,
  unlock: boolean,
): Promise<{ playbackUrl: string | null; requiresAuth: boolean }> {
  if (!unlock) {
    return { playbackUrl: null, requiresAuth: true };
  }
  if (source === 'URL') {
    const readable = await resolveReadableS3ObjectUrl(value, SIGNED_ASSET_TTL_SEC);
    return { playbackUrl: readable, requiresAuth: false };
  }
  if (!value.startsWith('courses/')) {
    throw new AppError('Không thể phát video', 500, 'COURSE_ASSET_INVALID');
  }
  const url = await createPresignedDownloadUrl({ key: value, expiresIn: SIGNED_ASSET_TTL_SEC });
  return { playbackUrl: url, requiresAuth: false };
}

async function resolveAttachmentLink(
  source: CourseAttachmentSource,
  value: string,
  name: string,
  unlock: boolean,
): Promise<{ url: string | null; requiresAuth: boolean }> {
  if (!unlock) {
    return { url: null, requiresAuth: true };
  }
  if (source === 'URL') {
    const readable = await resolveReadableS3ObjectUrl(value, SIGNED_ASSET_TTL_SEC);
    return { url: readable, requiresAuth: false };
  }
  if (!value.startsWith('courses/')) {
    throw new AppError('Không thể tải tệp', 500, 'COURSE_ASSET_INVALID');
  }
  const safeName = name.replace(/[^\w.\-()\s\u00C0-\u024F]+/g, '_').slice(0, 120) || 'file';
  const url = await createPresignedDownloadUrl({
    key: value,
    expiresIn: SIGNED_ASSET_TTL_SEC,
    downloadFileName: safeName,
  });
  return { url, requiresAuth: false };
}

export class CoursesService {
  private catalogWhere(userId: string | undefined): {
    status: CourseStatus;
    OR: Array<Record<string, unknown>>;
  } {
    const or: Array<Record<string, unknown>> = [{ visibility: 'PUBLIC' as const }];
    if (userId) {
      or.push({
        visibility: 'PRIVATE' as const,
        enrollments: { some: { userId } },
      });
    }
    return {
      status: 'PUBLISHED',
      OR: or,
    };
  }

  async listCourses(userId: string | undefined, query: CoursesListQuery) {
    const { page, limit, q } = query;
    const where: {
      status: CourseStatus;
      OR: Array<Record<string, unknown>>;
      title?: { contains: string; mode: 'insensitive' };
    } = {
      ...this.catalogWhere(userId),
    };
    if (q) {
      where.title = { contains: q, mode: 'insensitive' };
    }

    const [total, rows] = await prisma.$transaction([
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
          updatedAt: true,
        },
      }),
    ]);

    const courses = await Promise.all(
      rows.map(async (c) => ({
        ...c,
        thumbnailUrl: await resolveThumbnailForClient(c.thumbnailUrl),
      })),
    );

    return {
      courses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async getCourseBySlug(slug: string, userId: string | undefined) {
    const base = await prisma.course.findFirst({
      where: { slug, status: 'PUBLISHED' },
      include: {
        ...(userId
          ? {
              enrollments: {
                where: { userId },
                select: { id: true },
              },
            }
          : {}),
        lessons: {
          orderBy: { sortOrder: 'asc' },
          include: {
            videos: { orderBy: { sortOrder: 'asc' } },
            attachments: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });

    if (!base) {
      throw new AppError('Không tìm thấy khóa học', 404, 'COURSE_NOT_FOUND');
    }

    const enrollmentRows =
      'enrollments' in base && Array.isArray(base.enrollments) ? base.enrollments : [];
    const enrollment = Boolean(userId && enrollmentRows.length > 0);

    const visible =
      base.visibility === 'PUBLIC' || (userId && base.visibility === 'PRIVATE' && enrollment);

    if (!visible) {
      throw new AppError('Không tìm thấy khóa học', 404, 'COURSE_NOT_FOUND');
    }

    const contentUnlocked = canUnlockCourseContent(userId, base.visibility, enrollment);

    const { enrollments: _dropE, lessons, ...courseBase } = base;

    const thumbnailUrl = await resolveThumbnailForClient(courseBase.thumbnailUrl);

    const lessonsOut = await Promise.all(
      lessons.map(async (lesson) => {
        const videos = await Promise.all(
          lesson.videos.map(async (v) => {
            const resolved = await resolveVideoPlayback(v.source, v.value, contentUnlocked);
            return {
              id: v.id,
              sortOrder: v.sortOrder,
              source: v.source,
              requiresAuth: resolved.requiresAuth,
              playbackUrl: resolved.playbackUrl,
            };
          }),
        );
        const attachments = await Promise.all(
          lesson.attachments.map(async (a) => {
            const resolved = await resolveAttachmentLink(
              a.source,
              a.value,
              a.name,
              contentUnlocked,
            );
            return {
              id: a.id,
              name: a.name,
              sortOrder: a.sortOrder,
              requiresAuth: resolved.requiresAuth,
              url: resolved.url,
            };
          }),
        );
        return {
          id: lesson.id,
          title: lesson.title,
          sortOrder: lesson.sortOrder,
          videos,
          attachments,
        };
      }),
    );

    return {
      course: {
        id: courseBase.id,
        title: courseBase.title,
        slug: courseBase.slug,
        shortDescription: courseBase.shortDescription,
        description: courseBase.description,
        thumbnailUrl,
        visibility: courseBase.visibility,
        status: courseBase.status,
        createdAt: courseBase.createdAt,
        updatedAt: courseBase.updatedAt,
      },
      lessons: lessonsOut,
      contentUnlocked,
    };
  }
}
