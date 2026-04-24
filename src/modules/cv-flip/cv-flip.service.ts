import { config } from '@/config/env';
import { prisma } from '@/shared/database/prisma';
import { AppError } from '@/shared/errors/errorHandler';
import { getProvinceNameByCode, resolveProvinceCode } from '@/shared/provinces';
import { getVerifiedEmailForUser } from '@/shared/services/email-helper.service';
import { emailService } from '@/shared/services/email.service';
import { notificationService } from '@/shared/services/notification.service';
import { Prisma } from '@prisma/client';
import type { CandidateDetailQuery, CandidatesQuery, RequestsQuery } from './cv-flip.schema';

const CV_FLIP_FEATURE_KEY = 'CV_FLIP';
const DEFAULT_MONTHLY_TOTAL_LIMIT = 500;
const DEFAULT_MONTHLY_REQUEST_LIMIT = 100;
const REQUEST_EXPIRE_DAYS = 7;
const USD_TO_VND_RATE = 26_000;

type CompanyLimits = {
  enabled: boolean;
  monthlyTotalLimit: number;
  monthlyRequestLimit: number;
};

const parsePositiveNumber = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value <= 0) return null;
  return Math.floor(value);
};

const parseCompanyLimits = (metadata: Prisma.JsonValue | null | undefined): Pick<CompanyLimits, 'monthlyTotalLimit' | 'monthlyRequestLimit'> => {
  const fallback = {
    monthlyTotalLimit: DEFAULT_MONTHLY_TOTAL_LIMIT,
    monthlyRequestLimit: DEFAULT_MONTHLY_REQUEST_LIMIT,
  };

  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return fallback;
  }

  const record = metadata as Record<string, unknown>;
  const monthlyTotalLimit = parsePositiveNumber(record['monthlyTotalLimit']) ?? DEFAULT_MONTHLY_TOTAL_LIMIT;
  const monthlyRequestLimit = parsePositiveNumber(record['monthlyRequestLimit']) ?? DEFAULT_MONTHLY_REQUEST_LIMIT;

  return {
    monthlyTotalLimit,
    monthlyRequestLimit: Math.min(monthlyRequestLimit, monthlyTotalLimit),
  };
};

const getMonthYear = (date = new Date()): { month: number; year: number } => ({
  month: date.getUTCMonth() + 1,
  year: date.getUTCFullYear(),
});

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

const profileUrl = (slug: string | null): string => {
  const base = config.FRONTEND_ORIGIN || 'https://joywork.vn';
  return slug ? `${base}/profile/${slug}` : `${base}/account?tab=profile`;
};

const cvFlipRequestsUrl = (): string => {
  const base = config.FRONTEND_ORIGIN || 'https://joywork.vn';
  return `${base}/account?tab=profile`;
};

export class CvFlipService {
  private convertSalary(value: number, from: 'VND' | 'USD', to: 'VND' | 'USD'): number {
    if (from === to) return value;
    if (from === 'USD') return value * USD_TO_VND_RATE;
    return value / USD_TO_VND_RATE;
  }

  private normalizeSalaryRange(
    salaryMin: number | undefined,
    salaryMax: number | undefined
  ): { min: number | undefined; max: number | undefined } {
    const min = salaryMin !== undefined ? Math.floor(salaryMin * 0.8) : undefined;
    const max = salaryMax !== undefined ? Math.ceil(salaryMax * 1.2) : undefined;
    return { min, max };
  }

  private buildSalaryFilter(params: {
    salaryMin: number | undefined;
    salaryMax: number | undefined;
    salaryCurrency: 'VND' | 'USD';
  }): Prisma.UserWhereInput | null {
    const { salaryMin, salaryMax } = params;
    if (salaryMin === undefined && salaryMax === undefined) {
      return null;
    }

    const inputCurrency = params.salaryCurrency;
    const expanded = this.normalizeSalaryRange(salaryMin, salaryMax);
    const vndRange = {
      min: expanded.min !== undefined ? this.convertSalary(expanded.min, inputCurrency, 'VND') : undefined,
      max: expanded.max !== undefined ? this.convertSalary(expanded.max, inputCurrency, 'VND') : undefined,
    };
    const usdRange = {
      min: expanded.min !== undefined ? this.convertSalary(expanded.min, inputCurrency, 'USD') : undefined,
      max: expanded.max !== undefined ? this.convertSalary(expanded.max, inputCurrency, 'USD') : undefined,
    };

    const buildRangeConditions = (range: { min: number | undefined; max: number | undefined }): Prisma.UserProfileWhereInput[] => {
      const conditions: Prisma.UserProfileWhereInput[] = [];
      if (range.min !== undefined) {
        conditions.push({ expectedSalaryMax: { gte: Math.floor(range.min) } });
      }
      if (range.max !== undefined) {
        conditions.push({ expectedSalaryMin: { lte: Math.ceil(range.max) } });
      }
      return conditions;
    };

    const vndConditions = buildRangeConditions(vndRange);
    const usdConditions = buildRangeConditions(usdRange);

    return {
      OR: [
        {
          profile: {
            is: {
              salaryCurrency: 'VND',
              AND: vndConditions,
            },
          },
        },
        {
          profile: {
            is: {
              salaryCurrency: null,
              AND: vndConditions,
            },
          },
        },
        {
          profile: {
            is: {
              salaryCurrency: 'USD',
              AND: usdConditions,
            },
          },
        },
      ],
    };
  }

  private async searchCandidateIdsBySkills(skills: string[]): Promise<string[]> {
    const normalizedSkills = skills
      .map((skill) => skill.trim().toLowerCase())
      .filter((skill) => skill.length > 0);
    if (normalizedSkills.length === 0) {
      return [];
    }

    const likeClauses = normalizedSkills.map((skill) =>
      Prisma.sql`EXISTS (
        SELECT 1
        FROM unnest(up."skills") AS skill_item
        WHERE skill_item ILIKE ${`%${skill}%`}
      )`
    );

    const rows = await prisma.$queryRaw<Array<{ userId: string }>>(Prisma.sql`
      SELECT DISTINCT up."userId"
      FROM "user_profiles" up
      WHERE ${Prisma.join(likeClauses, ' OR ')}
    `);

    return rows.map((row) => row.userId);
  }

  private async assertCanManageCompany(userId: string, companyId: string): Promise<void> {
    const membership = await prisma.companyMember.findFirst({
      where: {
        userId,
        companyId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
      select: { id: true },
    });

    if (!membership) {
      throw new AppError('Bạn không có quyền thao tác với doanh nghiệp này', 403, 'COMPANY_PERMISSION_DENIED');
    }
  }

  private async getCompanyLimits(companyId: string): Promise<CompanyLimits> {
    const entitlement = await prisma.companyFeatureEntitlement.findUnique({
      where: {
        companyId_featureKey: {
          companyId,
          featureKey: CV_FLIP_FEATURE_KEY,
        },
      },
      select: {
        enabled: true,
        metadata: true,
      },
    });

    const parsed = parseCompanyLimits(entitlement?.metadata);

    return {
      enabled: entitlement?.enabled ?? false,
      monthlyTotalLimit: parsed.monthlyTotalLimit,
      monthlyRequestLimit: parsed.monthlyRequestLimit,
    };
  }

  async checkAccess(userId: string) {
    const companies = await prisma.companyMember.findMany({
      where: {
        userId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
      select: {
        companyId: true,
        role: true,
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            featureEntitlements: {
              where: { featureKey: CV_FLIP_FEATURE_KEY },
              take: 1,
              select: { enabled: true, metadata: true },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    return {
      companies: companies.map((item) => {
        const entitlement = item.company.featureEntitlements[0];
        const limits = parseCompanyLimits(entitlement?.metadata);
        return {
          id: item.company.id,
          name: item.company.name,
          slug: item.company.slug,
          logoUrl: item.company.logoUrl,
          role: item.role,
          isPremium: entitlement?.enabled ?? false,
          cvFlipEnabled: entitlement?.enabled ?? false,
          monthlyTotalLimit: limits.monthlyTotalLimit,
          monthlyRequestLimit: limits.monthlyRequestLimit,
        };
      }),
    };
  }

  async listCandidates(query: CandidatesQuery) {
    const {
      page,
      limit,
      keyword,
      skills,
      locations,
      ward,
      education,
      salaryMin,
      salaryMax,
      salaryCurrency,
      workMode,
      gender,
      yearOfBirthMin,
      yearOfBirthMax,
      educationLevels,
    } = query;

    const where: Prisma.UserWhereInput = {
      accountStatus: 'ACTIVE',
      profile: {
        is: {
          isPublic: true,
          isSearchingJob: true,
        },
      },
    };

    const andConditions: Prisma.UserWhereInput[] = [];

    if (keyword) {
      andConditions.push({
        OR: [
          // Ưu tiên match trên vị trí ứng tuyển (title) trước, rồi đến tiêu đề nghề nghiệp (headline).
          { profile: { is: { title: { contains: keyword, mode: 'insensitive' } } } },
          { profile: { is: { headline: { contains: keyword, mode: 'insensitive' } } } },
          { profile: { is: { fullName: { contains: keyword, mode: 'insensitive' } } } },
          { name: { contains: keyword, mode: 'insensitive' } },
          { profile: { is: { bio: { contains: keyword, mode: 'insensitive' } } } },
          { profile: { is: { skills: { hasSome: [keyword] } } } },
          { profile: { is: { knowledge: { hasSome: [keyword] } } } },
        ],
      });
    }

    if (skills && skills.length > 0) {
      const fuzzySkillMatchedUserIds = await this.searchCandidateIdsBySkills(skills);
      if (fuzzySkillMatchedUserIds.length === 0) {
        return {
          candidates: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 1,
          },
        };
      }
      andConditions.push({
        id: { in: fuzzySkillMatchedUserIds },
      });
    }

    if (locations && locations.length > 0) {
      const normalizedLocations = Array.from(
        new Set(locations.map((loc) => resolveProvinceCode(loc) ?? loc).filter((loc) => loc.length > 0))
      );
      if (normalizedLocations.length > 0) {
        andConditions.push({
          profile: { is: { locations: { hasSome: normalizedLocations } } },
        });
      }
    }

    if (ward) {
      andConditions.push({
        profile: { is: { wardCodes: { has: ward } } },
      });
    }

    if (education) {
      andConditions.push({
        educations: {
          some: {
            OR: [
              { degree: { contains: education, mode: 'insensitive' } },
              { school: { contains: education, mode: 'insensitive' } },
            ],
          },
        },
      });
    }

    if (workMode) {
      andConditions.push({
        profile: { is: { workMode: { equals: workMode, mode: 'insensitive' } } },
      });
    }

    const salaryFilter = this.buildSalaryFilter({
      salaryMin,
      salaryMax,
      salaryCurrency,
    });
    if (salaryFilter) {
      andConditions.push(salaryFilter);
    }

    if (gender) {
      andConditions.push({
        profile: { is: { gender } },
      });
    }

    if (yearOfBirthMin !== undefined || yearOfBirthMax !== undefined) {
      andConditions.push({
        profile: {
          is: {
            yearOfBirth: {
              ...(yearOfBirthMin !== undefined ? { gte: yearOfBirthMin } : {}),
              ...(yearOfBirthMax !== undefined ? { lte: yearOfBirthMax } : {}),
            },
          },
        },
      });
    }

    if (educationLevels && educationLevels.length > 0) {
      andConditions.push({
        profile: { is: { educationLevel: { in: educationLevels } } },
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    // Relevance-based ordering: title match (weight 7) > headline match (weight 6) >
    // fullName match (weight 5) > name match (weight 4) > bio match (weight 3) >
    // skills/knowledge match (weight 2) > fallback by updatedAt
    // Note: Prisma $queryRaw for weighted relevance scoring
    let orderedUserIds: string[] | null = null;
    let useRelevanceOrdering = Boolean(keyword);

    if (keyword) {
      const escapedKeyword = keyword.replace(/'/g, "''");

      // Only use relevance ordering if there are no additional complex filters
      // that would cause mismatch between raw query results and actual filtered results
      const hasComplexFilters = Boolean(skills?.length) || ward || education || workMode || salaryFilter;

      if (!hasComplexFilters) {
        // Include keyword filter in WHERE clause to ensure total matches actual results
        const rankedUsers = await prisma.$queryRaw<{ id: string }[]>`
          SELECT u.id
          FROM users u
          LEFT JOIN user_profiles p ON p."userId" = u.id
          WHERE u."accountStatus" = 'ACTIVE'
            AND p."isPublic" = true
            AND p."isSearchingJob" = true
            AND (
              p.title ILIKE ${`%${escapedKeyword}%`}
              OR p.headline ILIKE ${`%${escapedKeyword}%`}
              OR p."fullName" ILIKE ${`%${escapedKeyword}%`}
              OR u.name ILIKE ${`%${escapedKeyword}%`}
              OR p.bio ILIKE ${`%${escapedKeyword}%`}
              OR p.skills::text ILIKE ${`%${escapedKeyword}%`}
              OR p.knowledge::text ILIKE ${`%${escapedKeyword}%`}
            )
          ORDER BY
            CASE
              WHEN p.title ILIKE ${`%${escapedKeyword}%`} THEN 7
              WHEN p.headline ILIKE ${`%${escapedKeyword}%`} THEN 6
              WHEN p."fullName" ILIKE ${`%${escapedKeyword}%`} THEN 5
              WHEN u.name ILIKE ${`%${escapedKeyword}%`} THEN 4
              WHEN p.bio ILIKE ${`%${escapedKeyword}%`} THEN 3
              WHEN p.skills::text ILIKE ${`%${escapedKeyword}%`} OR p.knowledge::text ILIKE ${`%${escapedKeyword}%`} THEN 2
              ELSE 1
            END DESC,
            u."updatedAt" DESC
          LIMIT 10000
        `;
        orderedUserIds = rankedUsers.map((r) => r.id);
      } else {
        // Fallback: use updatedAt ordering when there are complex filters
        // to ensure total and results are consistent
        useRelevanceOrdering = false;
      }
    }

    // Paginate ordered IDs or count total with Prisma
    // When using relevance ordering, count with Prisma if there are additional filters
    // to ensure total matches actual filtered results
    let total: number;
    if (orderedUserIds && !useRelevanceOrdering) {
      // Fallback path: using updatedAt ordering, count with Prisma
      total = await prisma.user.count({ where });
      orderedUserIds = null; // Clear to use Prisma pagination below
    } else if (orderedUserIds) {
      // Relevance ordering without additional filters
      total = orderedUserIds.length;
    } else {
      // No keyword search, use Prisma count
      total = await prisma.user.count({ where });
    }

    const pageIds = orderedUserIds
      ? orderedUserIds.slice((page - 1) * limit, page * limit)
      : null;

    // Build query based on pagination mode
    const userSelect = {
      id: true,
      name: true,
      slug: true,
      experiences: {
        orderBy: [{ order: 'asc' as const }, { startDate: 'desc' as const }],
        select: { id: true, role: true, company: true, period: true, desc: true, achievements: true, order: true },
      },
      educations: {
        orderBy: [{ order: 'asc' as const }, { startDate: 'desc' as const }],
        select: { id: true, school: true, degree: true, period: true, gpa: true, honors: true, order: true },
      },
      profile: {
        select: {
          avatar: true,
          fullName: true,
          headline: true,
          title: true,
          skills: true,
          locations: true,
          expectedSalaryMin: true,
          expectedSalaryMax: true,
          salaryCurrency: true,
          workMode: true,
          gender: true,
          dayOfBirth: true,
          monthOfBirth: true,
          yearOfBirth: true,
          educationLevel: true,
        },
      },
    };

    const users = pageIds
      ? await prisma.user.findMany({
          where: { ...where, id: { in: pageIds } },
          skip: 0,
          take: limit,
          select: userSelect,
        })
      : await prisma.user.findMany({
          where,
          orderBy: [{ updatedAt: 'desc' as const }],
          skip: (page - 1) * limit,
          take: limit,
          select: userSelect,
        });

    // Reorder users to match relevance order when keyword search
    let orderedUsers = users;
    if (pageIds) {
      const userMap = new Map(users.map((u) => [u.id, u]));
      orderedUsers = pageIds.map((id) => userMap.get(id)).filter((u): u is NonNullable<typeof u> => u !== undefined);
    }

    return {
      candidates: orderedUsers.map((user) => ({
        userId: user.id,
        slug: user.slug,
        name: user.profile?.fullName || user.name,
        avatar: user.profile?.avatar ?? null,
        headline: user.profile?.headline ?? null,
        title: user.profile?.title ?? null,
        skills: user.profile?.skills ?? [],
        locations: user.profile?.locations ?? [],
        expectedSalaryMin: user.profile?.expectedSalaryMin ?? null,
        expectedSalaryMax: user.profile?.expectedSalaryMax ?? null,
        salaryCurrency: user.profile?.salaryCurrency ?? null,
        workMode: user.profile?.workMode ?? null,
        gender: user.profile?.gender ?? null,
        dayOfBirth: user.profile?.dayOfBirth ?? null,
        monthOfBirth: user.profile?.monthOfBirth ?? null,
        yearOfBirth: user.profile?.yearOfBirth ?? null,
        educationLevel: user.profile?.educationLevel ?? null,
        experiences: user.experiences.map((e) => ({
          id: e.id,
          role: e.role,
          company: e.company,
          period: e.period,
          desc: e.desc,
          achievements: e.achievements,
          order: e.order,
        })),
        educations: user.educations.map((e) => ({
          id: e.id,
          school: e.school,
          degree: e.degree,
          period: e.period,
          gpa: e.gpa,
          honors: e.honors,
          order: e.order,
        })),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getCandidateDetail(slugOrId: string, viewerUserId: string, query: CandidateDetailQuery) {
    const companyId = query.companyId;

    const candidate = await prisma.user.findFirst({
      where: {
        OR: [{ slug: slugOrId }, { id: slugOrId }],
        accountStatus: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        slug: true,
        profile: true,
        experiences: {
          orderBy: [{ order: 'asc' }, { startDate: 'desc' }],
        },
        educations: {
          orderBy: [{ order: 'asc' }, { startDate: 'desc' }],
        },
      },
    });

    if (!candidate || !candidate.profile) {
      throw new AppError('Không tìm thấy hồ sơ ứng viên', 404, 'CANDIDATE_NOT_FOUND');
    }

    const isOwner = viewerUserId === candidate.id;
    const normalizedCompanyId = companyId?.trim() || null;
    let hasAppliedToCompany = false;

    if (!isOwner) {
      if (normalizedCompanyId) {
        await this.assertCanManageCompany(viewerUserId, normalizedCompanyId);
        const application = await prisma.application.findFirst({
          where: {
            userId: candidate.id,
            status: { not: 'REJECTED' },
            job: { companyId: normalizedCompanyId },
          },
          select: { id: true },
        });
        hasAppliedToCompany = Boolean(application);
      }

      if (!candidate.profile.isPublic) {
        throw new AppError('Không tìm thấy hồ sơ ứng viên', 404, 'CANDIDATE_NOT_FOUND');
      }
      if (normalizedCompanyId && !candidate.profile.isSearchingJob && !hasAppliedToCompany) {
        throw new AppError('Không tìm thấy hồ sơ ứng viên', 404, 'CANDIDATE_NOT_FOUND');
      }
    }

    const buildCandidatePayload = (opts: {
      contactEmail: string | null;
      contactPhone: string | null;
      cvUrl: string | null;
      website: string | null;
      linkedin: string | null;
      github: string | null;
    }) => ({
      candidate: {
        userId: candidate.id,
        slug: candidate.slug,
        name: candidate.profile!.fullName || candidate.name,
        profile: {
          avatar: candidate.profile!.avatar,
          fullName: candidate.profile!.fullName,
          title: candidate.profile!.title,
          headline: candidate.profile!.headline,
          bio: candidate.profile!.bio,
          skills: candidate.profile!.skills,
          locations: candidate.profile!.locations,
          wardCodes: candidate.profile!.wardCodes,
          specificAddress: candidate.profile!.specificAddress,
          ...(candidate.profile!.locations.length > 0 ? { location: getProvinceNameByCode(candidate.profile!.locations[0]) ?? candidate.profile!.locations[0] } : {}),
          website: opts.website,
          linkedin: opts.linkedin,
          github: opts.github,
          status: candidate.profile!.status,
          knowledge: candidate.profile!.knowledge,
          attitude: candidate.profile!.attitude,
          expectedSalaryMin: candidate.profile!.expectedSalaryMin,
          expectedSalaryMax: candidate.profile!.expectedSalaryMax,
          salaryCurrency: candidate.profile!.salaryCurrency,
          workMode: candidate.profile!.workMode,
          expectedCulture: candidate.profile!.expectedCulture,
          careerGoals: candidate.profile!.careerGoals,
          contactEmail: opts.contactEmail,
          contactPhone: opts.contactPhone,
          cvUrl: opts.cvUrl,
          isSearchingJob: candidate.profile!.isSearchingJob,
          allowCvFlip: candidate.profile!.allowCvFlip,
        },
        experiences: candidate.experiences,
        educations: candidate.educations,
      },
    });

    // Không có companyId: chỉ chủ hồ sơ mới xem đủ thông tin liên hệ.
    if (!normalizedCompanyId) {
      const shouldMaskPublic = !isOwner;
      return {
        ...buildCandidatePayload({
          contactEmail: shouldMaskPublic ? null : candidate.profile.contactEmail,
          contactPhone: shouldMaskPublic ? null : candidate.profile.contactPhone,
          cvUrl: shouldMaskPublic ? null : candidate.profile.cvUrl,
          website: shouldMaskPublic ? null : candidate.profile.website,
          linkedin: shouldMaskPublic ? null : candidate.profile.linkedin,
          github: shouldMaskPublic ? null : candidate.profile.github,
        }),
        access: {
          isFlipped: isOwner,
          hasPendingRequest: false,
          connectionId: null,
          flippedAt: null,
          isOwnerView: isOwner,
          companyContext: false,
        },
      };
    }

    const connection = await prisma.cvFlipConnection.findUnique({
      where: {
        companyId_userId: {
          companyId: normalizedCompanyId,
          userId: candidate.id,
        },
      },
      select: {
        id: true,
        flippedAt: true,
      },
    });

    const pendingRequest = await prisma.cvFlipRequest.findUnique({
      where: {
        companyId_userId: {
          companyId: normalizedCompanyId,
          userId: candidate.id,
        },
      },
      select: {
        id: true,
        status: true,
        expiresAt: true,
      },
    });

    const now = new Date();
    const isPendingRequest =
      pendingRequest?.status === 'PENDING' &&
      pendingRequest.expiresAt.getTime() > now.getTime();

    const isFlipped = Boolean(connection) || hasAppliedToCompany;
    const shouldMaskContact = !isOwner && !isFlipped;

    return {
      ...buildCandidatePayload({
        contactEmail: shouldMaskContact ? null : candidate.profile.contactEmail,
        contactPhone: shouldMaskContact ? null : candidate.profile.contactPhone,
        cvUrl: shouldMaskContact ? null : candidate.profile.cvUrl,
        website: shouldMaskContact ? null : candidate.profile.website,
        linkedin: shouldMaskContact ? null : candidate.profile.linkedin,
        github: shouldMaskContact ? null : candidate.profile.github,
      }),
      access: {
        isFlipped: isOwner || isFlipped,
        hasPendingRequest: isPendingRequest,
        connectionId: connection?.id ?? null,
        flippedAt: connection?.flippedAt ?? null,
        isOwnerView: isOwner,
        companyContext: true,
      },
    };
  }

  async getUsage(userId: string, companyId: string) {
    await this.assertCanManageCompany(userId, companyId);

    const limits = await this.getCompanyLimits(companyId);
    const { month, year } = getMonthYear();
    const usage = await prisma.cvFlipUsage.findUnique({
      where: {
        companyId_month_year: { companyId, month, year },
      },
      select: {
        totalCount: true,
        requestCount: true,
      },
    });

    const totalUsed = usage?.totalCount ?? 0;
    const requestUsed = usage?.requestCount ?? 0;

    return {
      total: {
        used: totalUsed,
        limit: limits.monthlyTotalLimit,
        remaining: Math.max(0, limits.monthlyTotalLimit - totalUsed),
      },
      request: {
        used: requestUsed,
        limit: limits.monthlyRequestLimit,
        remaining: Math.max(0, limits.monthlyRequestLimit - requestUsed),
      },
      month,
      year,
    };
  }

  async flipCandidate(userId: string, companyId: string, candidateUserId: string) {
    await this.assertCanManageCompany(userId, companyId);

    const candidate = await prisma.user.findUnique({
      where: { id: candidateUserId },
      select: {
        id: true,
        slug: true,
        name: true,
        profile: {
          select: {
            id: true,
            isPublic: true,
            isSearchingJob: true,
            allowCvFlip: true,
          },
        },
      },
    });

    if (!candidate || !candidate.profile || !candidate.profile.isPublic || !candidate.profile.isSearchingJob) {
      throw new AppError('Không tìm thấy hồ sơ ứng viên', 404, 'CANDIDATE_NOT_FOUND');
    }

    const existingConnection = await prisma.cvFlipConnection.findUnique({
      where: {
        companyId_userId: {
          companyId,
          userId: candidateUserId,
        },
      },
      select: { id: true, flippedAt: true },
    });

    if (existingConnection) {
      return {
        status: 'ALREADY_FLIPPED' as const,
        connectionId: existingConnection.id,
        flippedAt: existingConnection.flippedAt,
      };
    }

    const limits = await this.getCompanyLimits(companyId);
    if (!limits.enabled) {
      throw new AppError(
        'Đây là tính năng trả phí của JOYWORK.VN. Vui lòng liên hệ contact@joywork.vn | 033 868 5855',
        403,
        'CV_FLIP_PREMIUM_REQUIRED'
      );
    }

    const { month, year } = getMonthYear();
    const usage = await prisma.cvFlipUsage.findUnique({
      where: { companyId_month_year: { companyId, month, year } },
      select: { totalCount: true, requestCount: true },
    });

    const totalCount = usage?.totalCount ?? 0;
    const requestCount = usage?.requestCount ?? 0;

    if (totalCount >= limits.monthlyTotalLimit) {
      throw new AppError('Doanh nghiệp đã hết tổng lượt mở CV trong tháng', 429, 'CV_FLIP_TOTAL_LIMIT_REACHED');
    }

    if (candidate.profile.allowCvFlip) {
      const flipped = await prisma.$transaction(async (tx) => {
        const connection = await tx.cvFlipConnection.create({
          data: {
            companyId,
            userId: candidateUserId,
            flippedById: userId,
          },
          select: {
            id: true,
            flippedAt: true,
          },
        });

        await tx.cvFlipUsage.upsert({
          where: { companyId_month_year: { companyId, month, year } },
          create: { companyId, month, year, totalCount: 1, requestCount: requestCount },
          update: { totalCount: { increment: 1 } },
        });

        return connection;
      });

      return {
        status: 'FLIPPED' as const,
        connectionId: flipped.id,
        flippedAt: flipped.flippedAt,
      };
    }

    if (requestCount >= limits.monthlyRequestLimit) {
      throw new AppError('Doanh nghiệp đã hết lượt mở CV qua yêu cầu trong tháng', 429, 'CV_FLIP_REQUEST_LIMIT_REACHED');
    }

    const existingRequest = await prisma.cvFlipRequest.findUnique({
      where: {
        companyId_userId: {
          companyId,
          userId: candidateUserId,
        },
      },
      select: {
        id: true,
        status: true,
        expiresAt: true,
      },
    });

    const now = new Date();
    const expiresAt = addDays(now, REQUEST_EXPIRE_DAYS);

    const request = existingRequest
      ? await prisma.cvFlipRequest.update({
          where: {
            companyId_userId: {
              companyId,
              userId: candidateUserId,
            },
          },
          data: {
            status: 'PENDING',
            requestedBy: userId,
            expiresAt,
            respondedAt: null,
          },
          select: { id: true, status: true, expiresAt: true },
        })
      : await prisma.cvFlipRequest.create({
          data: {
            companyId,
            userId: candidateUserId,
            requestedBy: userId,
            status: 'PENDING',
            expiresAt,
          },
          select: { id: true, status: true, expiresAt: true },
        });

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, slug: true },
    });
    const companyName = company?.name ?? 'Doanh nghiệp';
    const companyProfilePath = company?.slug ? `/companies/${company.slug}` : '/companies';
    const companyProfileUrl = `${config.FRONTEND_ORIGIN || 'https://joywork.vn'}${companyProfilePath}`;

    await notificationService.createNotification({
      userId: candidateUserId,
      type: 'CV_FLIP_REQUEST',
      title: 'Yêu cầu mở thông tin hồ sơ',
      content: `${companyName} muốn xem thông tin liên hệ trong hồ sơ của bạn. Mở Cài đặt hồ sơ để Đồng ý / Từ chối.`,
      metadata: {
        requestId: request.id,
        companyId,
        candidateUserId,
        targetUrl: '/account?tab=profile',
      },
      relatedEntityType: 'CV_FLIP_REQUEST',
      relatedEntityId: request.id,
    });

    const candidateEmail = await getVerifiedEmailForUser(candidateUserId);
    if (candidateEmail) {
      try {
        await emailService.sendCvFlipRequestEmail(candidateEmail, {
          companyName,
          companyProfileUrl,
          candidateName: candidate.name,
          requestsUrl: cvFlipRequestsUrl(),
          profileUrl: profileUrl(candidate.slug),
        });
      } catch {
        // Ignore email failure to avoid blocking request flow.
      }
    }

    return {
      status: 'REQUESTED' as const,
      requestId: request.id,
      expiresAt: request.expiresAt,
    };
  }

  private async expireOutdatedRequests(userId: string): Promise<void> {
    await prisma.cvFlipRequest.updateMany({
      where: {
        userId,
        status: 'PENDING',
        expiresAt: { lt: new Date() },
      },
      data: {
        status: 'EXPIRED',
      },
    });
  }

  async listMyRequests(userId: string, query: RequestsQuery) {
    await this.expireOutdatedRequests(userId);
    const { page, limit, status } = query;

    const where: Prisma.CvFlipRequestWhereInput = {
      userId,
    };
    if (status) {
      where.status = status;
    }

    const [requests, total] = await Promise.all([
      prisma.cvFlipRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          status: true,
          expiresAt: true,
          createdAt: true,
          respondedAt: true,
          company: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
              website: true,
            },
          },
        },
      }),
      prisma.cvFlipRequest.count({ where }),
    ]);

    return {
      requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async respondRequest(userId: string, requestId: string, action: 'approve' | 'reject') {
    const request = await prisma.cvFlipRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        companyId: true,
        userId: true,
        requestedBy: true,
        status: true,
        expiresAt: true,
        company: { select: { name: true } },
        user: { select: { name: true, slug: true } },
      },
    });

    if (!request || request.userId !== userId) {
      throw new AppError('Không tìm thấy yêu cầu', 404, 'CV_FLIP_REQUEST_NOT_FOUND');
    }

    if (request.status !== 'PENDING') {
      throw new AppError('Yêu cầu đã được xử lý trước đó', 400, 'CV_FLIP_REQUEST_ALREADY_PROCESSED');
    }

    const now = new Date();
    if (request.expiresAt.getTime() <= now.getTime()) {
      await prisma.cvFlipRequest.update({
        where: { id: request.id },
        data: { status: 'EXPIRED', respondedAt: now },
      });
      throw new AppError('Yêu cầu đã hết hạn', 409, 'CV_FLIP_REQUEST_EXPIRED');
    }

    if (action === 'reject') {
      await prisma.cvFlipRequest.update({
        where: { id: request.id },
        data: { status: 'REJECTED', respondedAt: now },
      });

      await notificationService.createNotification({
        userId: request.requestedBy,
        type: 'CV_FLIP_REJECTED',
        title: 'Ứng viên đã từ chối yêu cầu',
        content: 'Yêu cầu xem thông tin liên hệ đã bị từ chối.',
        metadata: { requestId: request.id, companyId: request.companyId },
        relatedEntityType: 'CV_FLIP_REQUEST',
        relatedEntityId: request.id,
      });

      const requesterEmail = await getVerifiedEmailForUser(request.requestedBy);
      if (requesterEmail) {
        try {
          await emailService.sendCvFlipResponseEmail(requesterEmail, {
            candidateName: request.user.name,
            approved: false,
            profileUrl: profileUrl(request.user.slug),
          });
        } catch {
          // Ignore email failure.
        }
      }

      return { status: 'REJECTED' as const };
    }

    const approved = await prisma.$transaction(async (tx) => {
      const limits = await this.getCompanyLimits(request.companyId);
      if (!limits.enabled) {
        await tx.cvFlipRequest.update({
          where: { id: request.id },
          data: { status: 'EXPIRED', respondedAt: now },
        });
        throw new AppError('Yêu cầu đã hết hạn', 409, 'CV_FLIP_REQUEST_EXPIRED');
      }

      const { month, year } = getMonthYear(now);
      const usage = await tx.cvFlipUsage.findUnique({
        where: { companyId_month_year: { companyId: request.companyId, month, year } },
        select: { totalCount: true, requestCount: true },
      });

      const totalCount = usage?.totalCount ?? 0;
      const requestCount = usage?.requestCount ?? 0;
      if (totalCount >= limits.monthlyTotalLimit || requestCount >= limits.monthlyRequestLimit) {
        await tx.cvFlipRequest.update({
          where: { id: request.id },
          data: { status: 'EXPIRED', respondedAt: now },
        });
        throw new AppError('Yêu cầu đã hết hạn', 409, 'CV_FLIP_REQUEST_EXPIRED');
      }

      const existingConnection = await tx.cvFlipConnection.findUnique({
        where: {
          companyId_userId: {
            companyId: request.companyId,
            userId: request.userId,
          },
        },
        select: { id: true, flippedAt: true },
      });

      const connection = existingConnection
        ? existingConnection
        : await tx.cvFlipConnection.create({
            data: {
              companyId: request.companyId,
              userId: request.userId,
              flippedById: request.requestedBy,
            },
            select: {
              id: true,
              flippedAt: true,
            },
          });

      await tx.cvFlipRequest.update({
        where: { id: request.id },
        data: {
          status: 'APPROVED',
          respondedAt: now,
        },
      });

      if (!existingConnection) {
        await tx.cvFlipUsage.upsert({
          where: { companyId_month_year: { companyId: request.companyId, month, year } },
          create: {
            companyId: request.companyId,
            month,
            year,
            totalCount: 1,
            requestCount: 1,
          },
          update: {
            totalCount: { increment: 1 },
            requestCount: { increment: 1 },
          },
        });
      }

      return connection;
    });

    await notificationService.createNotification({
      userId: request.requestedBy,
      type: 'CV_FLIP_APPROVED',
      title: 'Ứng viên đã đồng ý yêu cầu',
      content: 'Bạn đã có thể xem đầy đủ thông tin liên hệ của ứng viên.',
      metadata: {
        requestId: request.id,
        companyId: request.companyId,
        candidateUserId: request.userId,
      },
      relatedEntityType: 'CV_FLIP_REQUEST',
      relatedEntityId: request.id,
    });

    const requesterEmail = await getVerifiedEmailForUser(request.requestedBy);
    if (requesterEmail) {
      try {
        await emailService.sendCvFlipResponseEmail(requesterEmail, {
          candidateName: request.user.name,
          approved: true,
          profileUrl: profileUrl(request.user.slug),
        });
      } catch {
        // Ignore email failure.
      }
    }

    return {
      status: 'APPROVED' as const,
      connectionId: approved.id,
      flippedAt: approved.flippedAt,
    };
  }
}
