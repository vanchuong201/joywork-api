import { prisma } from '@/shared/database/prisma';
import { getProvinceNameByCode, resolveProvinceCode } from '@/shared/provinces';
import { SearchUsersInput } from './users.schema';
import { getEsClient } from '@/shared/elasticsearch/client';
import { USERS_INDEX } from '@/shared/elasticsearch/indices';

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

  // Search users
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
          const users = await prisma.user.findMany({ where: { id: { in: ids } }, include: { profile: true } });
          const userMap = new Map(users.map(u => [u.id, u]));
          const ordered = ids.map(id => userMap.get(id)).filter(Boolean) as typeof users;
          return {
            users: ordered.map(user => {
              const result: any = { id: user.id, role: user.role, createdAt: user.createdAt };
              if (user.name) result.name = user.name;
              if (user.profile) {
                result.profile = {
                  id: user.profile.id, userId: user.profile.userId,
                  skills: user.profile.skills, createdAt: user.profile.createdAt, updatedAt: user.profile.updatedAt,
                };
                if (user.profile.avatar) result.profile.avatar = user.profile.avatar;
                if (user.profile.headline) result.profile.headline = user.profile.headline;
                if (user.profile.bio) result.profile.bio = user.profile.bio;
                result.profile.locations = user.profile.locations;
                result.profile.wardCodes = user.profile.wardCodes;
                if (user.profile.locations.length > 0) {
                  result.profile.location = getProvinceNameByCode(user.profile.locations[0]) ?? user.profile.locations[0];
                }
              }
              return result;
            }),
            pagination: { page: data.page, limit: data.limit, total: ids.length, totalPages: Math.ceil(ids.length / data.limit) },
          };
        }
      } catch (err) {
        console.warn('[ES] User search failed, falling back to Prisma:', err);
      }
    }

    const { q, skills, location, page, limit } = data;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { profile: { headline: { contains: q, mode: 'insensitive' } } },
        { profile: { bio: { contains: q, mode: 'insensitive' } } },
      ];
    }

    if (skills) {
      const skillArray = skills.split(',').map(s => s.trim());
      where.profile = {
        ...where.profile,
        skills: {
          hasSome: skillArray,
        },
      };
    }

    if (location) {
      const normalizedLocation = resolveProvinceCode(location) ?? location;
      where.profile = {
        ...where.profile,
        locations: { has: normalizedLocation },
      };
    }

    // Get users with pagination
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          profile: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      users: users.map(user => {
        const result: any = {
          id: user.id,
          role: user.role,
          createdAt: user.createdAt,
        };
        if (user.name) result.name = user.name;
        if (user.profile) {
          result.profile = {
          id: user.profile.id,
          userId: user.profile.userId,
          skills: user.profile.skills,
          createdAt: user.profile.createdAt,
          updatedAt: user.profile.updatedAt,
          };
          if (user.profile.avatar) result.profile.avatar = user.profile.avatar;
          if (user.profile.headline) result.profile.headline = user.profile.headline;
          if (user.profile.bio) result.profile.bio = user.profile.bio;
          result.profile.locations = user.profile.locations;
          result.profile.wardCodes = user.profile.wardCodes;
          if (user.profile.locations.length > 0) {
            result.profile.location = getProvinceNameByCode(user.profile.locations[0]) ?? user.profile.locations[0];
          }
          if (user.profile.website) result.profile.website = user.profile.website;
          if (user.profile.linkedin) result.profile.linkedin = user.profile.linkedin;
          if (user.profile.github) result.profile.github = user.profile.github;
        }
        return result;
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  // Get user by ID (public profile)
  async getPublicProfile(userId: string): Promise<UserWithProfile | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
      },
    });

    if (!user) {
      return null;
    }

    const result: any = {
      id: user.id,
      role: user.role,
      createdAt: user.createdAt,
    };
    
    if (user.name) result.name = user.name;
    if (user.profile) {
      result.profile = {
        id: user.profile.id,
        userId: user.profile.userId,
        skills: user.profile.skills,
        createdAt: user.profile.createdAt,
        updatedAt: user.profile.updatedAt,
      };
      if (user.profile.avatar) result.profile.avatar = user.profile.avatar;
      if (user.profile.headline) result.profile.headline = user.profile.headline;
      if (user.profile.bio) result.profile.bio = user.profile.bio;
      result.profile.locations = user.profile.locations;
      result.profile.wardCodes = user.profile.wardCodes;
      result.profile.specificAddress = user.profile.specificAddress;
      if (user.profile.locations.length > 0) {
        result.profile.location = getProvinceNameByCode(user.profile.locations[0]) ?? user.profile.locations[0];
      }
      if (user.profile.website) result.profile.website = user.profile.website;
      if (user.profile.linkedin) result.profile.linkedin = user.profile.linkedin;
      if (user.profile.github) result.profile.github = user.profile.github;
    }
    
    return result;
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
          fields: ['name^3', 'headline^2', 'bio', 'email'],
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
