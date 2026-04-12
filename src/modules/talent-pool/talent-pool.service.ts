import { prisma } from '@/shared/database/prisma';
import { AppError } from '@/shared/errors/errorHandler';
import { getProvinceNameByCode, resolveProvinceCode } from '@/shared/provinces';
import { emailService } from '@/shared/services/email.service';
import { notificationService } from '@/shared/services/notification.service';
import { config } from '@/config/env';
import { Prisma } from '@prisma/client';
import type {
  AdminRequestsQuery,
  AdminMembersQuery,
  AdminAddMemberBody,
  AdminEntitlementsQuery,
  CandidatesQuery,
} from './talent-pool.schema';

const TALENT_POOL_FEATURE_KEY = 'TALENT_POOL';

function profileUrl(slug: string | null): string {
  const base = config.FRONTEND_ORIGIN || 'https://joywork.vn';
  return slug ? `${base}/profile/${slug}` : `${base}/account?tab=profile`;
}

// ── Candidate ──

export class TalentPoolService {

  async getMyStatus(userId: string) {
    const member = await prisma.talentPoolMember.findUnique({
      where: { userId },
      select: { id: true, status: true, source: true, reason: true, createdAt: true },
    });

    const latestRequest = await prisma.talentPoolRequest.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, status: true, message: true, reason: true,
        createdAt: true, reviewedAt: true,
      },
    });

    return { member, latestRequest };
  }

  async createRequest(userId: string, message?: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, slug: true },
    });

    const existingMember = await prisma.talentPoolMember.findUnique({
      where: { userId },
    });
    if (existingMember?.status === 'ACTIVE') {
      throw new AppError('Bạn đã là thành viên Talent Pool', 400, 'ALREADY_MEMBER');
    }

    const pendingRequest = await prisma.talentPoolRequest.findFirst({
      where: { userId, status: 'PENDING' },
    });
    if (pendingRequest) {
      throw new AppError('Bạn đã có yêu cầu đang chờ duyệt', 400, 'PENDING_REQUEST_EXISTS');
    }

    const request = await prisma.talentPoolRequest.create({
      data: { userId, message: message ?? null },
      select: { id: true, status: true, message: true, createdAt: true },
    });

    await prisma.talentPoolLog.create({
      data: {
        userId,
        actorId: userId,
        action: 'REQUEST_CREATED',
        metadata: { requestId: request.id },
      },
    });

    if (user?.email) {
      try {
        await emailService.sendTalentPoolRequestSubmittedEmail(
          user.email,
          { name: user.name, profileUrl: profileUrl(user.slug) },
        );
      } catch (err) {
        console.error('Failed to send talent pool request-submitted email:', err);
      }
    }

    return request;
  }

  // ── Admin: requests ──

  async listRequests(query: AdminRequestsQuery) {
    const { page, limit, status, q } = query;
    const where: Prisma.TalentPoolRequestWhereInput = {};

    if (status) where.status = status;
    if (q) {
      where.user = {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      };
    }

    const [requests, total] = await Promise.all([
      prisma.talentPoolRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, status: true, message: true, reason: true,
          createdAt: true, reviewedAt: true,
          user: {
            select: {
              id: true, email: true, name: true, slug: true,
              profile: { select: { avatar: true, headline: true } },
            },
          },
          reviewedBy: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.talentPoolRequest.count({ where }),
    ]);

    return {
      requests,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async approveRequest(requestId: string, adminId: string) {
    const request = await prisma.talentPoolRequest.findUnique({
      where: { id: requestId },
      include: { user: { select: { id: true, email: true, name: true, slug: true } } },
    });
    if (!request) throw new AppError('Không tìm thấy yêu cầu', 404, 'REQUEST_NOT_FOUND');
    if (request.status !== 'PENDING') {
      throw new AppError('Yêu cầu đã được xử lý', 400, 'REQUEST_ALREADY_PROCESSED');
    }

    await prisma.$transaction(async (tx) => {
      await tx.talentPoolRequest.update({
        where: { id: requestId },
        data: { status: 'APPROVED', reviewedById: adminId, reviewedAt: new Date() },
      });

      await tx.talentPoolMember.upsert({
        where: { userId: request.userId },
        create: { userId: request.userId, source: 'SELF_REQUEST', status: 'ACTIVE' },
        update: { status: 'ACTIVE', source: 'SELF_REQUEST', reason: null },
      });

      await tx.talentPoolLog.create({
        data: {
          userId: request.userId,
          actorId: adminId,
          action: 'REQUEST_APPROVED',
          metadata: { requestId },
        },
      });
    });

    if (request.user.email) {
      try {
        await emailService.sendTalentPoolApprovedEmail(
          request.user.email,
          { name: request.user.name, profileUrl: profileUrl(request.user.slug) },
        );
      } catch (err) {
        console.error('Failed to send talent pool approved email:', err);
      }
    }

    try {
      await notificationService.createNotification({
        userId: request.userId,
        type: 'SYSTEM',
        title: 'Yêu cầu Talent Pool đã được phê duyệt',
        content: 'Chúc mừng bạn! Hồ sơ của bạn đã được thêm vào Talent Pool của JOYWORK.',
        metadata: {
          requestId,
          status: 'APPROVED',
          targetUrl: '/account?tab=profile',
        },
        relatedEntityType: 'TALENT_POOL_REQUEST',
        relatedEntityId: requestId,
      });
    } catch (err) {
      console.error('Failed to create talent pool approved notification:', err);
    }

    return { success: true };
  }

  async rejectRequest(requestId: string, adminId: string, reason: string) {
    const request = await prisma.talentPoolRequest.findUnique({
      where: { id: requestId },
      include: { user: { select: { id: true, email: true, name: true, slug: true } } },
    });
    if (!request) throw new AppError('Không tìm thấy yêu cầu', 404, 'REQUEST_NOT_FOUND');
    if (request.status !== 'PENDING') {
      throw new AppError('Yêu cầu đã được xử lý', 400, 'REQUEST_ALREADY_PROCESSED');
    }

    await prisma.$transaction(async (tx) => {
      await tx.talentPoolRequest.update({
        where: { id: requestId },
        data: { status: 'REJECTED', reason, reviewedById: adminId, reviewedAt: new Date() },
      });

      await tx.talentPoolLog.create({
        data: {
          userId: request.userId,
          actorId: adminId,
          action: 'REQUEST_REJECTED',
          metadata: { requestId, reason },
        },
      });
    });

    if (request.user.email) {
      try {
        await emailService.sendTalentPoolRejectedEmail(
          request.user.email,
          { name: request.user.name, reason, profileUrl: profileUrl(request.user.slug) },
        );
      } catch (err) {
        console.error('Failed to send talent pool rejected email:', err);
      }
    }

    try {
      await notificationService.createNotification({
        userId: request.userId,
        type: 'SYSTEM',
        title: 'Yêu cầu Talent Pool chưa được phê duyệt',
        content: 'JOYWORK đã cập nhật kết quả xét duyệt Talent Pool. Vui lòng xem chi tiết và cập nhật hồ sơ nếu cần.',
        metadata: {
          requestId,
          status: 'REJECTED',
          reason,
          targetUrl: '/account?tab=profile',
        },
        relatedEntityType: 'TALENT_POOL_REQUEST',
        relatedEntityId: requestId,
      });
    } catch (err) {
      console.error('Failed to create talent pool rejected notification:', err);
    }

    return { success: true };
  }

  // ── Admin: members ──

  async listMembers(query: AdminMembersQuery) {
    const { page, limit, q, status } = query;
    const where: Prisma.TalentPoolMemberWhereInput = {};

    if (status) where.status = status;
    if (q) {
      where.user = {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      };
    }

    const [members, total] = await Promise.all([
      prisma.talentPoolMember.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, status: true, source: true, reason: true, createdAt: true,
          user: {
            select: {
              id: true, email: true, name: true, slug: true,
              profile: { select: { avatar: true, headline: true, locations: true, wardCodes: true } },
            },
          },
          addedBy: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.talentPoolMember.count({ where }),
    ]);

    return {
      members,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async lookupUserByEmail(email: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true, email: true, name: true, slug: true, accountStatus: true,
        profile: { select: { avatar: true, headline: true, locations: true, wardCodes: true } },
        talentPoolMember: { select: { id: true, status: true } },
      },
    });
    if (!user) throw new AppError('Không tìm thấy người dùng', 404, 'USER_NOT_FOUND');
    return user;
  }

  async adminAddMember(adminId: string, body: AdminAddMemberBody) {
    const { email, reason } = body;

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, slug: true },
    });
    if (!user) throw new AppError('Không tìm thấy người dùng', 404, 'USER_NOT_FOUND');

    const existing = await prisma.talentPoolMember.findUnique({
      where: { userId: user.id },
    });
    if (existing?.status === 'ACTIVE') {
      throw new AppError('Người dùng đã là thành viên Talent Pool', 400, 'ALREADY_MEMBER');
    }

    await prisma.$transaction(async (tx) => {
      await tx.talentPoolMember.upsert({
        where: { userId: user.id },
        create: { userId: user.id, source: 'ADMIN_ADD', addedById: adminId, reason, status: 'ACTIVE' },
        update: { source: 'ADMIN_ADD', addedById: adminId, reason, status: 'ACTIVE' },
      });

      // Auto-resolve any pending request
      await tx.talentPoolRequest.updateMany({
        where: { userId: user.id, status: 'PENDING' },
        data: { status: 'APPROVED', reviewedById: adminId, reviewedAt: new Date() },
      });

      await tx.talentPoolLog.create({
        data: {
          userId: user.id,
          actorId: adminId,
          action: 'ADMIN_ADDED',
          metadata: { reason },
        },
      });
    });

    if (user.email) {
      try {
        await emailService.sendTalentPoolAdminAddedEmail(
          user.email,
          { name: user.name, profileUrl: profileUrl(user.slug) },
        );
      } catch (err) {
        console.error('Failed to send talent pool admin-added email:', err);
      }
    }

    return { success: true };
  }

  async removeMember(memberId: string, adminId: string, reason: string) {
    const member = await prisma.talentPoolMember.findUnique({
      where: { id: memberId },
      include: { user: { select: { id: true, email: true, name: true, slug: true } } },
    });
    if (!member) throw new AppError('Không tìm thấy thành viên', 404, 'MEMBER_NOT_FOUND');
    if (member.status !== 'ACTIVE') {
      throw new AppError('Thành viên đã bị gỡ', 400, 'MEMBER_ALREADY_REMOVED');
    }

    await prisma.$transaction(async (tx) => {
      await tx.talentPoolMember.update({
        where: { id: memberId },
        data: { status: 'REMOVED', reason },
      });

      await tx.talentPoolLog.create({
        data: {
          userId: member.userId,
          actorId: adminId,
          action: 'MEMBER_REMOVED',
          metadata: { memberId, reason },
        },
      });
    });

    if (member.user.email) {
      try {
        await emailService.sendTalentPoolRemovedEmail(
          member.user.email,
          { name: member.user.name, reason, profileUrl: profileUrl(member.user.slug) },
        );
      } catch (err) {
        console.error('Failed to send talent pool removed email:', err);
      }
    }

    try {
      await notificationService.createNotification({
        userId: member.userId,
        type: 'SYSTEM',
        title: 'Bạn đã bị gỡ khỏi Talent Pool',
        content: `JOYWORK đã cập nhật trạng thái Talent Pool của bạn. Lý do: ${reason}`,
        metadata: {
          memberId,
          status: 'REMOVED',
          reason,
          targetUrl: '/account?tab=profile',
        },
        relatedEntityType: 'TALENT_POOL_MEMBER',
        relatedEntityId: memberId,
      });
    } catch (err) {
      console.error('Failed to create talent pool removed notification:', err);
    }

    return { success: true };
  }

  // ── Admin: entitlements ──

  async listEntitlements(query: AdminEntitlementsQuery) {
    const { page, limit, q, enabled } = query;

    const andConditions: Prisma.CompanyWhereInput[] = [];

    if (q) {
      andConditions.push({
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { slug: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    if (enabled === true) {
      andConditions.push({
        featureEntitlements: {
          some: {
            featureKey: TALENT_POOL_FEATURE_KEY,
            enabled: true,
          },
        },
      });
    } else if (enabled === false) {
      andConditions.push({
        OR: [
          {
            featureEntitlements: {
              none: {
                featureKey: TALENT_POOL_FEATURE_KEY,
              },
            },
          },
          {
            featureEntitlements: {
              some: {
                featureKey: TALENT_POOL_FEATURE_KEY,
                enabled: false,
              },
            },
          },
        ],
      });
    }

    const companyWhere: Prisma.CompanyWhereInput = andConditions.length > 0 ? { AND: andConditions } : {};

    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where: companyWhere,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, name: true, slug: true, logoUrl: true, isVerified: true,
          featureEntitlements: {
            where: { featureKey: TALENT_POOL_FEATURE_KEY },
            select: { id: true, enabled: true, expiresAt: true },
          },
        },
      }),
      prisma.company.count({ where: companyWhere }),
    ]);

    const items = companies.map((c) => {
      const ent = c.featureEntitlements[0];
      return {
        companyId: c.id,
        name: c.name,
        slug: c.slug,
        logoUrl: c.logoUrl,
        isVerified: c.isVerified,
        talentPoolEnabled: ent?.enabled ?? false,
        entitlementId: ent?.id ?? null,
      };
    });

    return {
      companies: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async toggleEntitlement(companyId: string, enabled: boolean) {
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!company) throw new AppError('Không tìm thấy công ty', 404, 'COMPANY_NOT_FOUND');

    await prisma.companyFeatureEntitlement.upsert({
      where: { companyId_featureKey: { companyId, featureKey: TALENT_POOL_FEATURE_KEY } },
      create: { companyId, featureKey: TALENT_POOL_FEATURE_KEY, enabled },
      update: { enabled },
    });

    return { companyId, enabled };
  }

  // ── Access check & candidate list ──

  async checkAccess(userId: string): Promise<{ hasAccess: boolean; reason?: string }> {
    const eligibleMemberships = await prisma.companyMember.findMany({
      where: { userId, role: { in: ['OWNER', 'ADMIN'] } },
      select: { companyId: true },
    });

    if (eligibleMemberships.length === 0) {
      return { hasAccess: false, reason: 'NO_ELIGIBLE_COMPANY' };
    }

    const companyIds = eligibleMemberships.map((m) => m.companyId);

    const entitlement = await prisma.companyFeatureEntitlement.findFirst({
      where: {
        companyId: { in: companyIds },
        featureKey: TALENT_POOL_FEATURE_KEY,
        enabled: true,
      },
    });

    if (!entitlement) {
      return { hasAccess: false, reason: 'NO_PREMIUM_ACCESS' };
    }

    return { hasAccess: true };
  }

  async listCandidates(query: CandidatesQuery) {
    const { page, limit, q, location, ward } = query;

    const where: Prisma.TalentPoolMemberWhereInput = {
      status: 'ACTIVE',
    };

    const conditions: Prisma.UserWhereInput[] = [];

    if (q) {
      conditions.push({
        OR: [
          { profile: { headline: { contains: q, mode: 'insensitive' } } },
          { profile: { bio: { contains: q, mode: 'insensitive' } } },
        ],
      });
    }

    if (location) {
      const normalizedLocation = resolveProvinceCode(location) ?? location;
      conditions.push({
        profile: { locations: { has: normalizedLocation } },
      });
    }

    if (ward) {
      conditions.push({
        profile: { wardCodes: { has: ward } },
      });
    }

    if (conditions.length > 0) {
      where.user = { AND: conditions };
    }

    const [members, total] = await Promise.all([
      prisma.talentPoolMember.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          createdAt: true,
          user: {
            select: {
              id: true, name: true, slug: true,
              profile: {
                select: {
                  avatar: true, headline: true, bio: true, skills: true,
                  locations: true, wardCodes: true, knowledge: true, attitude: true,
                  expectedSalaryMin: true, expectedSalaryMax: true, salaryCurrency: true, workMode: true, expectedCulture: true,
                  isPublic: true, visibility: true,
                },
              },
            },
          },
        },
      }),
      prisma.talentPoolMember.count({ where }),
    ]);

    const candidates = members.map((m) => {
      const u = m.user;
      const p = u.profile;

      if (!p || !p.isPublic) {
        return {
          memberId: m.id,
          joinedAt: m.createdAt,
          userId: u.id,
          name: u.name,
          slug: u.slug,
          isPublic: p?.isPublic ?? false,
          profile: null,
        };
      }

      const vis = (p.visibility as Record<string, boolean> | null) ?? {};

      return {
        memberId: m.id,
        joinedAt: m.createdAt,
        userId: u.id,
        name: u.name,
        slug: u.slug,
        isPublic: true,
        profile: {
          avatar: p.avatar,
          headline: p.headline,
          bio: vis['bio'] !== false ? p.bio : null,
          skills: p.skills,
          locations: p.locations,
          wardCodes: p.wardCodes,
          ...(p.locations.length > 0 ? { location: getProvinceNameByCode(p.locations[0]) ?? p.locations[0] } : {}),
          knowledge: vis['ksa'] !== false ? p.knowledge : [],
          attitude: vis['ksa'] !== false ? p.attitude : [],
          expectedSalaryMin: vis['expectations'] !== false ? p.expectedSalaryMin : null,
          expectedSalaryMax: vis['expectations'] !== false ? p.expectedSalaryMax : null,
          salaryCurrency: vis['expectations'] !== false ? p.salaryCurrency : null,
          workMode: vis['expectations'] !== false ? p.workMode : null,
          expectedCulture: vis['expectations'] !== false ? p.expectedCulture : null,
        },
      };
    });

    return {
      candidates,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
