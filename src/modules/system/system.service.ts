import { prisma } from '@/shared/database/prisma';
import { Prisma, CompanyVerificationStatus, UserAccountStatus } from '@prisma/client';
import { AppError } from '@/shared/errors/errorHandler';
import { createPresignedDownloadUrl } from '@/shared/storage/s3';
import { emailService } from '@/shared/services/email.service';
import { config } from '@/config/env';
import type {
  AdminCompaniesQuery,
  AdminReportTimeseriesQuery,
  AdminUsersQuery,
} from '@/modules/system/system.schema';

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

export class SystemService {
  private static readonly TALENT_POOL_FEATURE_KEY = 'TALENT_POOL';

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
}


