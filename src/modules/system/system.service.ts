import { prisma } from '@/shared/database/prisma';
import { Prisma, CompanyVerificationStatus } from '@prisma/client';
import { createPresignedDownloadUrl } from '@/shared/storage/s3';
import { emailService } from '@/shared/services/email.service';
import { config } from '@/config/env';

export interface SystemOverview {
  users: number;
  companies: number;
  posts: number;
  jobs: number;
  applications: number;
  follows: number;
  jobFavorites: number;
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

export class SystemService {
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


