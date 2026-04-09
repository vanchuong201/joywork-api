import { prisma } from '@/shared/database/prisma';
import {
  Prisma,
  CompanyShowcaseListType,
  CompanyVerificationStatus,
  UserAccountStatus,
} from '@prisma/client';
import { AppError } from '@/shared/errors/errorHandler';
import { emailService } from '@/shared/services/email.service';
import { config } from '@/config/env';
import { notificationService } from '@/shared/services/notification.service';
import {
  buildS3ObjectUrl,
  createPresignedDownloadUrl,
  getS3BucketName,
  resolveReadableS3ObjectUrl,
  s3Client,
} from '@/shared/storage/s3';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import type {
  AdminCompaniesQuery,
  AdminCompanyShowcaseType,
  AdminJobsQuery,
  AdminPostsQuery,
  AdminReportTimeseriesQuery,
  AdminUsersQuery,
} from '@/modules/system/system.schema';
import { getVerifiedEmailsForUsers } from '@/shared/services/email-helper.service';

export interface SystemOverview {
  users: number;
  companies: number;
  posts: number;
  jobs: number;
  applications: number;
  follows: number;
  jobFavorites: number;
}

export interface AdminPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminUserListItem {
  id: string;
  email: string;
  name: string | null;
  slug: string | null;
  role: string;
  emailVerified: boolean;
  accountStatus: string;
  createdAt: Date;
}

export interface AdminCompanyListItem {
  id: string;
  name: string;
  slug: string;
  legalName: string | null;
  verificationStatus: string;
  isVerified: boolean;
  isPremium: boolean;
  createdAt: Date;
  memberCount: number;
  jobCount: number;
}

export interface ReportDayPoint {
  date: string;
  count: number;
}

export interface CompanyVerificationItem {
  id: string;
  name: string;
  legalName: string | null;
  slug: string;
  verificationStatus: string;
  verificationFileUrl: string | null;
  verificationSubmittedAt: Date | null;
  verificationReviewedAt: Date | null;
  verificationReviewedById: string | null;
  verificationRejectReason: string | null;
  isVerified: boolean;
}

export interface AdminJobListItem {
  id: string;
  title: string;
  companyId: string;
  companyName: string;
  companySlug: string;
  updatedAt: Date;
  createdAt: Date;
  reminderSentAt: Date | null;
  adminEmails: string[];
}

export interface AdminPostListItem {
  id: string;
  title: string;
  type: string;
  visibility: string;
  hiddenFromFeed: boolean;
  deletedByJoyworkAt: Date | null;
  deletedByJoyworkReason: string | null;
  companyId: string;
  companyName: string;
  companySlug: string;
  createdAt: Date;
  publishedAt: Date | null;
}

export interface AdminProvinceAliasItem {
  id: string;
  aliasText: string;
  aliasSlug: string;
  aliasType: string;
  isActive: boolean;
}

export interface AdminProvinceRegistryItem {
  code: string;
  name: string;
  type: string;
  region: string;
  merged: boolean;
  isActive: boolean;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  aliases: AdminProvinceAliasItem[];
}

export interface CompanyShowcaseItem {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  tagline: string | null;
  coverUrl: string | null;
  order: number;
}

function toDateKeyUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildDayRange(days: number): { start: Date; keys: string[] } {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const keys: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    keys.push(toDateKeyUTC(d));
  }
  return { start, keys };
}

function mapCountsToSeries(
  keys: string[],
  rows: { day: Date; count: number }[]
): ReportDayPoint[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(toDateKeyUTC(new Date(r.day)), Number(r.count));
  }
  return keys.map((date) => ({ date, count: map.get(date) ?? 0 }));
}

function subtractDays(base: Date, days: number): Date {
  const value = new Date(base);
  value.setDate(value.getDate() - days);
  return value;
}

export class SystemService {
  private static readonly TALENT_POOL_FEATURE_KEY = 'TALENT_POOL';
  private static readonly SHOWCASE_MAX_FILE_SIZE = 8 * 1024 * 1024;

  private sanitizeFileName(name: string): string {
    return name.trim().replace(/[^a-zA-Z0-9.\-_]+/g, '-');
  }

  private prismaShowcaseListType(type: AdminCompanyShowcaseType): CompanyShowcaseListType {
    return type === 'FEATURED' ? CompanyShowcaseListType.FEATURED : CompanyShowcaseListType.TOP;
  }

  private async buildCompanyShowcaseItemFromSlot(
    slot: {
      sortOrder: number;
      featuredCoverUrl: string | null;
      company: {
        id: string;
        name: string;
        slug: string;
        logoUrl: string | null;
        tagline: string | null;
        coverUrl: string | null;
      };
    },
    listType: AdminCompanyShowcaseType,
  ): Promise<CompanyShowcaseItem> {
    const rawCover =
      listType === 'FEATURED'
        ? (slot.featuredCoverUrl ?? slot.company.coverUrl ?? null)
        : (slot.company.coverUrl ?? null);
    return {
      id: slot.company.id,
      name: slot.company.name,
      slug: slot.company.slug,
      logoUrl: await resolveReadableS3ObjectUrl(slot.company.logoUrl ?? null),
      tagline: slot.company.tagline ?? null,
      coverUrl: await resolveReadableS3ObjectUrl(rawCover),
      order: slot.sortOrder,
    };
  }

  private async normalizeShowcaseOrders(type: AdminCompanyShowcaseType) {
    const listType = this.prismaShowcaseListType(type);
    const rows = await prisma.companyShowcaseSlot.findMany({
      where: { listType },
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
      select: { id: true },
    });

    await prisma.$transaction(
      rows.map((row, idx) =>
        prisma.companyShowcaseSlot.update({
          where: { id: row.id },
          data: { sortOrder: idx + 1 },
        }),
      ),
    );
  }

  async listUsersForAdmin(query: AdminUsersQuery): Promise<{
    users: AdminUserListItem[];
    pagination: AdminPagination;
  }> {
    const { page, limit, q, role, accountStatus } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};
    if (role) {
      where.role = role;
    }
    if (accountStatus) {
      where.accountStatus = accountStatus;
    }
    if (q) {
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          slug: true,
          role: true,
          emailVerified: true,
          accountStatus: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async setUserAccountStatus(
    actorAdminId: string,
    targetUserId: string,
    status: UserAccountStatus
  ): Promise<{ id: string; email: string; accountStatus: UserAccountStatus }> {
    if (actorAdminId === targetUserId) {
      throw new AppError('Không thể thay đổi trạng thái tài khoản của chính bạn', 400, 'INVALID_TARGET');
    }

    try {
      const updated = await prisma.user.update({
        where: { id: targetUserId },
        data: { accountStatus: status },
        select: {
          id: true,
          email: true,
          accountStatus: true,
        },
      });
      return updated;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new AppError('Không tìm thấy người dùng', 404, 'USER_NOT_FOUND');
      }
      throw e;
    }
  }

  async listCompaniesForAdmin(query: AdminCompaniesQuery): Promise<{
    companies: AdminCompanyListItem[];
    pagination: AdminPagination;
  }> {
    const { page, limit, q, verificationStatus } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.CompanyWhereInput = {};
    if (verificationStatus) {
      where.verificationStatus = verificationStatus;
    }
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
        { legalName: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, rows] = await Promise.all([
      prisma.company.count({ where }),
      prisma.company.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          slug: true,
          legalName: true,
          verificationStatus: true,
          isVerified: true,
          createdAt: true,
          _count: {
            select: { members: true, jobs: true },
          },
          featureEntitlements: {
            where: { featureKey: SystemService.TALENT_POOL_FEATURE_KEY },
            select: { enabled: true },
            take: 1,
          },
        },
      }),
    ]);

    const companies: AdminCompanyListItem[] = rows.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      legalName: c.legalName ?? null,
      verificationStatus: c.verificationStatus,
      isVerified: c.isVerified,
      isPremium: c.featureEntitlements[0]?.enabled ?? false,
      createdAt: c.createdAt,
      memberCount: c._count.members,
      jobCount: c._count.jobs,
    }));

    return {
      companies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async listJobsForAdmin(query: AdminJobsQuery): Promise<{
    jobs: AdminJobListItem[];
    pagination: AdminPagination;
  }> {
    const { page, limit, q, filter } = query;
    const skip = (page - 1) * limit;
    const now = new Date();
    const fifteenDaysAgo = subtractDays(now, 15);
    const twentyDaysAgo = subtractDays(now, 20);

    const where: Prisma.JobWhereInput = {
      isActive: true,
    };

    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { company: { name: { contains: q, mode: 'insensitive' } } },
        { company: { slug: { contains: q, mode: 'insensitive' } } },
      ];
    }

    if (filter === 'expiring_soon') {
      where.updatedAt = {
        lt: fifteenDaysAgo,
        gte: twentyDaysAgo,
      };
    }

    if (filter === 'expired') {
      where.updatedAt = {
        lt: twentyDaysAgo,
      };
    }

    const [total, rows] = await Promise.all([
      prisma.job.count({ where }),
      prisma.job.findMany({
        where,
        orderBy: { updatedAt: 'asc' },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          createdAt: true,
          updatedAt: true,
          reminderSentAt: true,
          company: {
            select: {
              id: true,
              name: true,
              slug: true,
              members: {
                where: {
                  role: { in: ['OWNER', 'ADMIN'] },
                },
                select: {
                  userId: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const adminIds = Array.from(new Set(rows.flatMap((job) => job.company.members.map((member) => member.userId))));
    const verifiedEmailMap = adminIds.length > 0 ? await getVerifiedEmailsForUsers(adminIds) : new Map<string, string>();

    const jobs = rows.map((row) => ({
      id: row.id,
      title: row.title,
      companyId: row.company.id,
      companyName: row.company.name,
      companySlug: row.company.slug,
      updatedAt: row.updatedAt,
      createdAt: row.createdAt,
      reminderSentAt: row.reminderSentAt,
      adminEmails: row.company.members
        .map((member) => verifiedEmailMap.get(member.userId))
        .filter((email): email is string => Boolean(email)),
    }));

    return {
      jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async listCompanyShowcaseForAdmin(type: AdminCompanyShowcaseType): Promise<{ companies: CompanyShowcaseItem[] }> {
    const listType = this.prismaShowcaseListType(type);
    const slots = await prisma.companyShowcaseSlot.findMany({
      where: { listType },
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
      include: {
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            tagline: true,
            coverUrl: true,
          },
        },
      },
    });

    const companies = await Promise.all(
      slots.map((slot) => this.buildCompanyShowcaseItemFromSlot(slot, type)),
    );
    return { companies };
  }

  async addCompanyToShowcaseForAdmin(
    type: AdminCompanyShowcaseType,
    companyId: string,
    coverUrl?: string,
  ): Promise<{ company: CompanyShowcaseItem }> {
    const listType = this.prismaShowcaseListType(type);

    const exists = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!exists) {
      throw new AppError('Không tìm thấy công ty', 404, 'COMPANY_NOT_FOUND');
    }

    const dup = await prisma.companyShowcaseSlot.findUnique({
      where: {
        companyId_listType: {
          companyId,
          listType,
        },
      },
      select: { id: true },
    });
    if (dup) {
      throw new AppError('Công ty đã có trong danh sách này', 400, 'ALREADY_IN_SHOWCASE');
    }

    const slot = await prisma.$transaction(async (tx) => {
      const maxOrderRow = await tx.companyShowcaseSlot.aggregate({
        _max: { sortOrder: true },
        where: { listType },
      });
      const nextOrder = (maxOrderRow._max.sortOrder ?? 0) + 1;

      return tx.companyShowcaseSlot.create({
        data: {
          companyId,
          listType,
          sortOrder: nextOrder,
          ...(type === 'FEATURED' && coverUrl ? { featuredCoverUrl: coverUrl } : {}),
        },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
              tagline: true,
              coverUrl: true,
            },
          },
        },
      });
    });

    return {
      company: await this.buildCompanyShowcaseItemFromSlot(slot, type),
    };
  }

  async removeCompanyFromShowcaseForAdmin(type: AdminCompanyShowcaseType, companyId: string): Promise<{ id: string }> {
    const listType = this.prismaShowcaseListType(type);
    const removed = await prisma.companyShowcaseSlot.deleteMany({
      where: { companyId, listType },
    });
    if (removed.count === 0) {
      throw new AppError('Công ty không có trong danh sách này', 404, 'NOT_IN_SHOWCASE');
    }

    await this.normalizeShowcaseOrders(type);
    return { id: companyId };
  }

  async reorderCompanyShowcaseForAdmin(
    type: AdminCompanyShowcaseType,
    companyIds: string[],
  ): Promise<{ companies: CompanyShowcaseItem[] }> {
    const listType = this.prismaShowcaseListType(type);
    const existing = await this.listCompanyShowcaseForAdmin(type);
    const existingIds = existing.companies.map((company) => company.id);
    if (existingIds.length !== companyIds.length) {
      throw new AppError('Danh sách sắp xếp không hợp lệ', 400, 'INVALID_SHOWCASE_ORDER');
    }
    const existingSet = new Set(existingIds);
    if (companyIds.some((id) => !existingSet.has(id))) {
      throw new AppError('Danh sách sắp xếp không hợp lệ', 400, 'INVALID_SHOWCASE_ORDER');
    }

    await prisma.$transaction(
      companyIds.map((companyId, idx) =>
        prisma.companyShowcaseSlot.update({
          where: {
            companyId_listType: {
              companyId,
              listType,
            },
          },
          data: { sortOrder: idx + 1 },
        }),
      ),
    );

    return this.listCompanyShowcaseForAdmin(type);
  }

  async uploadFeaturedCompanyShowcaseCover(input: {
    fileName: string;
    fileType: 'image/jpeg' | 'image/png' | 'image/webp';
    fileData: string;
  }): Promise<{ coverUrl: string }> {
    const buffer = Buffer.from(input.fileData, 'base64');
    if (!buffer.length) {
      throw new AppError('Ảnh cover không được rỗng', 400, 'EMPTY_FILE');
    }
    if (buffer.length > SystemService.SHOWCASE_MAX_FILE_SIZE) {
      throw new AppError('Kích thước ảnh cover vượt quá giới hạn 8MB', 400, 'FILE_TOO_LARGE');
    }

    const ext = input.fileType === 'image/png' ? '.png' : input.fileType === 'image/webp' ? '.webp' : '.jpg';
    const safeName = this.sanitizeFileName(input.fileName);
    const base = safeName.replace(/\.[^.]+$/, '');
    const key = `system/showcase/featured-cover/${base || 'cover'}-${crypto.randomUUID()}${ext}`;

    try {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: getS3BucketName(),
          Key: key,
          Body: buffer,
          ContentType: input.fileType,
          ContentLength: buffer.length,
        }),
      );
    } catch {
      throw new AppError('Không thể tải ảnh cover, vui lòng thử lại.', 500, 'UPLOAD_FAILED');
    }

    return {
      coverUrl: buildS3ObjectUrl(key),
    };
  }

  async setFeaturedCompanyShowcaseCover(
    companyId: string,
    coverUrl: string,
  ): Promise<{ company: CompanyShowcaseItem }> {
    try {
      const slot = await prisma.companyShowcaseSlot.update({
        where: {
          companyId_listType: {
            companyId,
            listType: CompanyShowcaseListType.FEATURED,
          },
        },
        data: { featuredCoverUrl: coverUrl },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
              tagline: true,
              coverUrl: true,
            },
          },
        },
      });

      return {
        company: await this.buildCompanyShowcaseItemFromSlot(slot, 'FEATURED'),
      };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new AppError(
          'Công ty chưa nằm trong danh sách nổi bật',
          400,
          'NOT_IN_FEATURED_SHOWCASE',
        );
      }
      throw e;
    }
  }

  async listPostsForAdmin(query: AdminPostsQuery): Promise<{
    posts: AdminPostListItem[];
    pagination: AdminPagination;
  }> {
    const { page, limit, q, companyId } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.PostWhereInput = {};
    if (companyId) {
      where.companyId = companyId;
    }
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { company: { name: { contains: q, mode: 'insensitive' } } },
        { company: { slug: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [total, rows] = await Promise.all([
      prisma.post.count({ where }),
      prisma.post.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          type: true,
          visibility: true,
          hiddenFromFeed: true,
          deletedByJoyworkAt: true,
          deletedByJoyworkReason: true,
          createdAt: true,
          publishedAt: true,
          company: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      } as any),
    ]);

    const posts: AdminPostListItem[] = (rows as any[]).map((row) => ({
      id: row.id,
      title: row.title,
      type: row.type,
      visibility: row.visibility,
      hiddenFromFeed: row.hiddenFromFeed,
      deletedByJoyworkAt: row.deletedByJoyworkAt,
      deletedByJoyworkReason: row.deletedByJoyworkReason,
      companyId: row.company.id,
      companyName: row.company.name,
      companySlug: row.company.slug,
      createdAt: row.createdAt,
      publishedAt: row.publishedAt,
    }));

    return {
      posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async setPostFeedVisibility(
    postId: string,
    hiddenFromFeed: boolean
  ): Promise<{ id: string; hiddenFromFeed: boolean }> {
    try {
      const updated = await prisma.post.update({
        where: { id: postId },
        data: {
          hiddenFromFeed,
        },
        select: {
          id: true,
          hiddenFromFeed: true,
        },
      });
      return updated;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new AppError('Không tìm thấy bài viết', 404, 'POST_NOT_FOUND');
      }
      throw error;
    }
  }

  async deletePostByJoywork(
    _adminId: string,
    postId: string,
    reason: string
  ): Promise<{ id: string; deletedByJoyworkAt: Date | null; deletedByJoyworkReason: string | null }> {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        title: true,
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            members: {
              where: { role: { in: ['OWNER', 'ADMIN'] } },
              select: {
                userId: true,
                user: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!post) {
      throw new AppError('Không tìm thấy bài viết', 404, 'POST_NOT_FOUND');
    }

    const now = new Date();
    const updated = await prisma.post.update({
      where: { id: postId },
      data: {
        deletedByJoyworkAt: now,
        deletedByJoyworkReason: reason,
      },
      select: {
        id: true,
        deletedByJoyworkAt: true,
        deletedByJoyworkReason: true,
      },
    } as any);

    const adminIds = post.company.members.map((member) => member.userId);
    const verifiedEmailMap = adminIds.length > 0 ? await getVerifiedEmailsForUsers(adminIds) : new Map<string, string>();
    const targetUrl = `/companies/${post.company.slug}/manage?tab=activity`;

    await notificationService.createNotificationsForUsers(adminIds, {
      type: 'SYSTEM',
      title: 'Bài viết đã bị JOYWORK gỡ',
      content: `Bài viết "${post.title}" đã bị gỡ khỏi hiển thị. Lý do: ${reason}`,
      metadata: {
        companyId: post.company.id,
        companySlug: post.company.slug,
        targetUrl,
        reason,
      },
      relatedEntityType: 'POST',
      relatedEntityId: postId,
    });

    await Promise.all(
      post.company.members.map(async (member) => {
        const email = verifiedEmailMap.get(member.userId);
        if (!email) return;
        await emailService.sendCompanyPostDeletedByJoyworkEmail(email, {
          recipientName: member.user.name,
          companyName: post.company.name,
          postTitle: post.title,
          reason,
          manageUrl: `${config.FRONTEND_ORIGIN}${targetUrl}`,
        });
      })
    );

    return updated;
  }

  async restorePostByJoywork(
    _adminId: string,
    postId: string
  ): Promise<{ id: string; deletedByJoyworkAt: Date | null; deletedByJoyworkReason: string | null }> {
    try {
      const updated = await prisma.post.update({
        where: { id: postId },
        data: {
          deletedByJoyworkAt: null,
          deletedByJoyworkReason: null,
        },
        select: {
          id: true,
          deletedByJoyworkAt: true,
          deletedByJoyworkReason: true,
        },
      } as any);
      return updated;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new AppError('Không tìm thấy bài viết', 404, 'POST_NOT_FOUND');
      }
      throw error;
    }
  }

  async sendExpiringReminderForJob(jobId: string): Promise<{ id: string; reminderSentAt: Date }> {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        isActive: true,
        company: {
          select: {
            name: true,
            slug: true,
            members: {
              where: {
                role: { in: ['OWNER', 'ADMIN'] },
              },
              select: {
                userId: true,
                user: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!job) {
      throw new AppError('Không tìm thấy tin tuyển dụng', 404, 'JOB_NOT_FOUND');
    }
    if (!job.isActive) {
      throw new AppError('Tin tuyển dụng đã đóng', 400, 'JOB_INACTIVE');
    }

    const now = new Date();
    const fifteenDaysAgo = subtractDays(now, 15);
    const twentyDaysAgo = subtractDays(now, 20);
    if (job.updatedAt >= fifteenDaysAgo || job.updatedAt < twentyDaysAgo) {
      throw new AppError('Tin tuyển dụng chưa đến ngưỡng nhắc nhở', 400, 'JOB_NOT_ELIGIBLE_FOR_REMINDER');
    }

    const elapsedDays = Math.floor((now.getTime() - job.updatedAt.getTime()) / (24 * 60 * 60 * 1000));
    const daysLeft = Math.max(0, 20 - elapsedDays);
    const manageUrl = `${config.FRONTEND_ORIGIN}/companies/${job.company.slug}/manage?tab=jobs`;
    const adminIds = job.company.members.map((member) => member.userId);
    const verifiedEmailMap = adminIds.length > 0 ? await getVerifiedEmailsForUsers(adminIds) : new Map<string, string>();

    await Promise.all(
      job.company.members.map(async (member) => {
        const email = verifiedEmailMap.get(member.userId);
        if (!email) return;
        await emailService.sendJobExpiringReminderEmail(email, {
          recipientName: member.user.name,
          jobTitle: job.title,
          companyName: job.company.name,
          manageUrl,
          daysLeft,
        });
      }),
    );

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: { reminderSentAt: now },
      select: {
        id: true,
        reminderSentAt: true,
      },
    });

    return {
      id: updated.id,
      reminderSentAt: updated.reminderSentAt as Date,
    };
  }

  async closeJobByAdmin(jobId: string): Promise<{ id: string; isActive: boolean }> {
    try {
      const updated = await prisma.job.update({
        where: { id: jobId },
        data: {
          isActive: false,
        },
        select: {
          id: true,
          isActive: true,
        },
      });
      return updated;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new AppError('Không tìm thấy tin tuyển dụng', 404, 'JOB_NOT_FOUND');
      }
      throw error;
    }
  }

  async closeExpiredJobsByAdmin(): Promise<{ closedCount: number }> {
    const twentyDaysAgo = subtractDays(new Date(), 20);
    const result = await prisma.job.updateMany({
      where: {
        isActive: true,
        updatedAt: {
          lt: twentyDaysAgo,
        },
      },
      data: {
        isActive: false,
      },
    });

    return { closedCount: result.count };
  }

  async getReportTimeseries(query: AdminReportTimeseriesQuery): Promise<{
    days: number;
    userSignups: ReportDayPoint[];
    applications: ReportDayPoint[];
  }> {
    const days = query.days;
    const { start, keys } = buildDayRange(days);

    const [userRows, appRows] = await Promise.all([
      prisma.$queryRaw<{ day: Date; count: number }[]>`
        SELECT (date_trunc('day', "createdAt"))::date AS day, COUNT(*)::int AS count
        FROM users
        WHERE "createdAt" >= ${start}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      prisma.$queryRaw<{ day: Date; count: number }[]>`
        SELECT (date_trunc('day', "appliedAt"))::date AS day, COUNT(*)::int AS count
        FROM applications
        WHERE "appliedAt" >= ${start}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
    ]);

    return {
      days,
      userSignups: mapCountsToSeries(keys, userRows),
      applications: mapCountsToSeries(keys, appRows),
    };
  }

  async setCompanyPremiumStatus(
    companyId: string,
    isPremium: boolean
  ): Promise<{ id: string; isPremium: boolean }> {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });

    if (!company) {
      throw new AppError('Không tìm thấy công ty', 404, 'COMPANY_NOT_FOUND');
    }

    await prisma.companyFeatureEntitlement.upsert({
      where: {
        companyId_featureKey: {
          companyId,
          featureKey: SystemService.TALENT_POOL_FEATURE_KEY,
        },
      },
      create: {
        companyId,
        featureKey: SystemService.TALENT_POOL_FEATURE_KEY,
        enabled: isPremium,
      },
      update: {
        enabled: isPremium,
      },
    });

    return {
      id: company.id,
      isPremium,
    };
  }

  async getOverview(): Promise<SystemOverview> {
    const [users, companies, posts, jobs, applications, follows, jobFavorites] = await Promise.all([
      prisma.user.count(),
      prisma.company.count(),
      prisma.post.count(),
      prisma.job.count(),
      prisma.application.count(),
      prisma.follow.count(),
      prisma.jobFavorite.count(),
    ]);

    return {
      users,
      companies,
      posts,
      jobs,
      applications,
      follows,
      jobFavorites,
    };
  }

  async listCompanyVerifications(status?: string): Promise<CompanyVerificationItem[]> {
    const where: Prisma.CompanyWhereInput = {};
    if (status && Object.values(CompanyVerificationStatus).includes(status as CompanyVerificationStatus)) {
      where.verificationStatus = status as CompanyVerificationStatus;
    }
    const companies = await prisma.company.findMany({
      where,
      orderBy: { verificationSubmittedAt: 'desc' },
      select: {
        id: true,
        name: true,
        legalName: true,
        slug: true,
        verificationStatus: true,
        verificationFileUrl: true,
        verificationSubmittedAt: true,
        verificationReviewedAt: true,
        verificationReviewedById: true,
        verificationRejectReason: true,
        isVerified: true,
      },
    });

    return companies.map((c) => ({
      id: c.id,
      name: c.name,
      legalName: c.legalName ?? null,
      slug: c.slug,
      verificationStatus: c.verificationStatus,
      verificationFileUrl: c.verificationFileUrl ?? null,
      verificationSubmittedAt: c.verificationSubmittedAt ?? null,
      verificationReviewedAt: c.verificationReviewedAt ?? null,
      verificationReviewedById: c.verificationReviewedById ?? null,
      verificationRejectReason: c.verificationRejectReason ?? null,
      isVerified: c.isVerified,
    }));
  }

  async approveCompanyVerification(companyId: string, adminId: string) {
    const company = await prisma.company.update({
      where: { id: companyId },
      data: {
        verificationStatus: 'VERIFIED',
        isVerified: true,
        verificationReviewedAt: new Date(),
        verificationReviewedById: adminId,
        verificationRejectReason: null,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        verificationStatus: true,
        isVerified: true,
      },
    });

    // Send email to owner
    try {
      const ownerMember = await prisma.companyMember.findFirst({
        where: {
          companyId,
          role: 'OWNER',
        },
        include: {
          user: {
            select: {
              email: true,
              name: true,
            },
          },
        },
      });

      if (ownerMember?.user?.email) {
        const manageUrl = `${config.FRONTEND_ORIGIN}/companies/${company.slug}/manage`;
        await emailService.sendCompanyVerificationApprovedEmail(ownerMember.user.email, {
          companyName: company.name,
          ownerName: ownerMember.user.name,
          manageUrl,
        });
      }
    } catch (error) {
      console.error('Failed to send verification approved email', error);
      // Don't throw - email failure shouldn't block the approval
    }

    return company;
  }

  async rejectCompanyVerification(companyId: string, adminId: string, reason?: string | null) {
    const company = await prisma.company.update({
      where: { id: companyId },
      data: {
        verificationStatus: 'REJECTED',
        isVerified: false,
        verificationReviewedAt: new Date(),
        verificationReviewedById: adminId,
        verificationRejectReason: reason ?? null,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        verificationStatus: true,
        isVerified: true,
        verificationRejectReason: true,
      },
    });

    // Send email to owner
    try {
      const ownerMember = await prisma.companyMember.findFirst({
        where: {
          companyId,
          role: 'OWNER',
        },
        include: {
          user: {
            select: {
              email: true,
              name: true,
            },
          },
        },
      });

      if (ownerMember?.user?.email) {
        const manageUrl = `${config.FRONTEND_ORIGIN}/companies/${company.slug}/manage`;
        await emailService.sendCompanyVerificationRejectedEmail(ownerMember.user.email, {
          companyName: company.name,
          ownerName: ownerMember.user.name,
          rejectReason: company.verificationRejectReason,
          manageUrl,
        });
      }
    } catch (error) {
      console.error('Failed to send verification rejected email', error);
      // Don't throw - email failure shouldn't block the rejection
    }

    return company;
  }

  async getCompanyVerificationDownloadUrl(companyId: string) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { verificationFileKey: true },
    });

    if (!company?.verificationFileKey) {
      throw new Error('FILE_NOT_FOUND');
    }

    const key = company.verificationFileKey;
    const fileName = key.split('/').pop() || 'verification';
    const url = await createPresignedDownloadUrl({
      key,
      downloadFileName: fileName,
      expiresIn: 300,
    });

    return { url };
  }

  async listProvinceRegistryForAdmin(): Promise<{
    provinces: AdminProvinceRegistryItem[];
  }> {
    const rows = await prisma.provinceRegistry.findMany({
      include: {
        aliases: {
          where: { isActive: true },
          orderBy: { aliasSlug: 'asc' },
          select: {
            id: true,
            aliasText: true,
            aliasSlug: true,
            aliasType: true,
            isActive: true,
          },
        },
      },
      orderBy: [{ region: 'asc' }, { name: 'asc' }],
    });

    return {
      provinces: rows.map((row) => ({
        code: row.code,
        name: row.name,
        type: row.type,
        region: row.region,
        merged: row.merged,
        isActive: row.isActive,
        effectiveFrom: row.effectiveFrom,
        effectiveTo: row.effectiveTo,
        aliases: row.aliases,
      })),
    };
  }
}


