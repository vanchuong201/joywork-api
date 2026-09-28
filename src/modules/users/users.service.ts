import { prisma } from '@/shared/database/prisma';
import { getProvinceNameByCode, resolveProvinceCode } from '@/shared/provinces';
import { SearchUsersInput } from './users.schema';
import { getEsClient } from '@/shared/elasticsearch/client';
import { USERS_INDEX } from '@/shared/elasticsearch/indices';
import { Prisma } from '@prisma/client';
import { defaultCvIs } from '@/shared/candidates/cv-readiness';
import { buildDiscoverableUserWhere } from '@/shared/candidates/discoverable';

const PUBLIC_USER_INCLUDE = {
  profile: { include: { defaultCv: true } },
} satisfies Prisma.UserInclude;

type PublicUserRow = Prisma.UserGetPayload<{ include: typeof PUBLIC_USER_INCLUDE }>;

function serializePublicUser(
  user: PublicUserRow,
  opts: { includeLinks: boolean; includeAddress?: boolean }
): any {
  const result: any = { id: user.id, role: user.role, createdAt: user.createdAt };
  if (user.name) result.name = user.name;
  const cv = user.profile?.defaultCv;
  if (user.profile && cv) {
    result.profile = {
      id: user.profile.id,
      userId: user.profile.userId,
      skills: cv.skills,
      createdAt: user.profile.createdAt,
      updatedAt: cv.updatedAt,
    };
    if (cv.avatar) result.profile.avatar = cv.avatar;
    if (cv.headline) result.profile.headline = cv.headline;
    if (cv.bio) result.profile.bio = cv.bio;
    result.profile.locations = cv.locations;
    result.profile.wardCodes = cv.wardCodes;
    if (opts.includeAddress) result.profile.specificAddress = cv.specificAddress;
    if (cv.locations.length > 0) {
      result.profile.location = getProvinceNameByCode(cv.locations[0]) ?? cv.locations[0];
    }
    if (opts.includeLinks) {
      if (cv.website) result.profile.website = cv.website;
      if (cv.linkedin) result.profile.linkedin = cv.linkedin;
      if (cv.github) result.profile.github = cv.github;
    }
  }
  return result;
}

export interface UserProfile {
  id: string;
  userId: string;
  avatar?: string;
  headline?: string;
  bio?: string;
  skills: string[];
  cvUrl?: string;
  locations: string[];
  wardCodes: string[];
  specificAddress?: string | null;
  website?: string;
  linkedin?: string;
  github?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserWithProfile {
  id: string;
  email: string;
  name?: string;
  role: string;
  createdAt: Date;
  profile?: UserProfile;
}

export class UsersService {
  // Get user profile by user ID (GET /me). Nội dung profile lấy từ CV mặc định.
  async getUserProfile(userId: string): Promise<UserWithProfile | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: { include: { defaultCv: true } },
      },
    });

    if (!user) {
      return null;
    }

    const result: any = {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified, // Include email verification status
      role: user.role,
      createdAt: user.createdAt,
      avatar: user.avatar || null, // Account avatar - always include (even if null)
      slug: user.slug || null, // User slug - always include (even if null)
    };

    if (user.name) result.name = user.name;
    const cv = user.profile?.defaultCv;
    if (user.profile && cv) {
      result.profile = {
        id: user.profile.id,
        userId: user.profile.userId,
        defaultCvId: cv.id,
        skills: cv.skills,
        createdAt: user.profile.createdAt,
        updatedAt: cv.updatedAt,
      };
      if (cv.avatar) result.profile.avatar = cv.avatar;
      if (cv.headline) result.profile.headline = cv.headline;
      if (cv.bio) result.profile.bio = cv.bio;
      if (cv.cvUrl) result.profile.cvUrl = cv.cvUrl;
      result.profile.locations = cv.locations;
      result.profile.wardCodes = cv.wardCodes;
      result.profile.specificAddress = cv.specificAddress;
      if (cv.locations.length > 0) {
        result.profile.location = getProvinceNameByCode(cv.locations[0]) ?? cv.locations[0];
      }
      if (cv.website) result.profile.website = cv.website;
      if (cv.linkedin) result.profile.linkedin = cv.linkedin;
      if (cv.github) result.profile.github = cv.github;
    }

    return result;
  }

  // Search users — chỉ ứng viên đang bật tìm việc với CV mặc định đủ điều kiện.
  async searchUsers(data: SearchUsersInput): Promise<{
    users: UserWithProfile[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    // Try Elasticsearch first for text queries
    if (data.q) {
      try {
        const ids = await this.searchUsersInEs(data);
        if (ids !== null) {
          if (ids.length === 0) {
            return { users: [], pagination: { page: data.page, limit: data.limit, total: 0, totalPages: 0 } };
          }
          const users = await prisma.user.findMany({
            where: { AND: [{ id: { in: ids } }, buildDiscoverableUserWhere()] },
            include: PUBLIC_USER_INCLUDE,
          });
          const userMap = new Map(users.map(u => [u.id, u]));
          const ordered = ids.map(id => userMap.get(id)).filter(Boolean) as typeof users;
          return {
            users: ordered.map(user => serializePublicUser(user, { includeLinks: false })),
            pagination: { page: data.page, limit: data.limit, total: ordered.length, totalPages: Math.ceil(ordered.length / data.limit) },
          };
        }
      } catch {
        // ES lỗi → fallback Prisma
      }
    }

    const { q, skills, location, page, limit } = data;
    const skip = (page - 1) * limit;

    const conditions: Prisma.UserWhereInput[] = [buildDiscoverableUserWhere()];

    if (q) {
      conditions.push({
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          defaultCvIs({ headline: { contains: q, mode: 'insensitive' } }),
          defaultCvIs({ bio: { contains: q, mode: 'insensitive' } }),
        ],
      });
    }

    if (skills) {
      const skillArray = skills.split(',').map(s => s.trim());
      conditions.push(defaultCvIs({ skills: { hasSome: skillArray } }));
    }

    if (location) {
      const normalizedLocation = resolveProvinceCode(location) ?? location;
      conditions.push(defaultCvIs({ locations: { has: normalizedLocation } }));
    }

    const where: Prisma.UserWhereInput = { AND: conditions };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: PUBLIC_USER_INCLUDE,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      users: users.map(user => serializePublicUser(user, { includeLinks: true })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  // Get user by ID (public profile) — chỉ khi ứng viên đang bật tìm việc.
  async getPublicProfile(userId: string): Promise<UserWithProfile | null> {
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        accountStatus: 'ACTIVE',
        profile: { is: { isSearchingJob: true } },
      },
      include: PUBLIC_USER_INCLUDE,
    });

    if (!user) {
      return null;
    }

    return serializePublicUser(user, { includeLinks: true, includeAddress: true });
  }

  // ─── Elasticsearch search helpers ─────────────────────────────────────────

  private async searchUsersInEs(data: SearchUsersInput): Promise<string[] | null> {
    const client = getEsClient();
    if (!client) return null;

    const must: object[] = [];
    const filter: object[] = [];

    if (data.q) {
      must.push({
        multi_match: {
          query: data.q,
          fields: ['name^3', 'headline^2', 'bio'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    if (data.skills) {
      const skillArray = data.skills.split(',').map((s: string) => s.trim());
      filter.push({ terms: { profileSkills: skillArray } });
    }

    if (data.location) {
      const code = resolveProvinceCode(data.location) ?? data.location;
      filter.push({ term: { profileLocations: code } });
    }

    filter.push({ term: { isSearchingJob: true } });

    const response = await client.search({
      index: USERS_INDEX,
      query: { bool: { must, filter } },
      _source: ['id'],
      size: data.limit,
      from: (data.page - 1) * data.limit,
      sort: must.length > 0
        ? [{ _score: { order: 'desc' } }, { createdAt: { order: 'desc' } }]
        : [{ createdAt: { order: 'desc' } }],
    });

    return (response.hits.hits as Array<{ _source: { id: string } }>).map(h => h._source.id);
  }
}
