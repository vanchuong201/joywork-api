import { prisma } from '@/shared/database/prisma';
import { AppError } from '@/shared/errors/errorHandler';
import {
  UpdateProfileInput,
  GetUserProfileInput,
  SearchUsersInput,
} from './users.schema';

export interface UserProfile {
  id: string;
  userId: string;
  avatar?: string;
  headline?: string;
  bio?: string;
  skills: string[];
  cvUrl?: string;
  location?: string;
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
  // Get user profile by user ID
  async getUserProfile(userId: string): Promise<UserWithProfile | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
      },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      profile: user.profile ? {
        id: user.profile.id,
        userId: user.profile.userId,
        avatar: user.profile.avatar,
        headline: user.profile.headline,
        bio: user.profile.bio,
        skills: user.profile.skills,
        cvUrl: user.profile.cvUrl,
        location: user.profile.location,
        website: user.profile.website,
        linkedin: user.profile.linkedin,
        github: user.profile.github,
        createdAt: user.profile.createdAt,
        updatedAt: user.profile.updatedAt,
      } : undefined,
    };
  }

  // Update user profile
  async updateProfile(userId: string, data: UpdateProfileInput): Promise<UserProfile> {
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Update or create profile
    const profile = await prisma.userProfile.upsert({
      where: { userId },
      update: {
        ...data,
        updatedAt: new Date(),
      },
      create: {
        userId,
        ...data,
      },
    });

    return {
      id: profile.id,
      userId: profile.userId,
      avatar: profile.avatar,
      headline: profile.headline,
      bio: profile.bio,
      skills: profile.skills,
      cvUrl: profile.cvUrl,
      location: profile.location,
      website: profile.website,
      linkedin: profile.linkedin,
      github: profile.github,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
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
      where.profile = {
        ...where.profile,
        location: { contains: location, mode: 'insensitive' },
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
      users: users.map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
        profile: user.profile ? {
          id: user.profile.id,
          userId: user.profile.userId,
          avatar: user.profile.avatar,
          headline: user.profile.headline,
          bio: user.profile.bio,
          skills: user.profile.skills,
          cvUrl: user.profile.cvUrl,
          location: user.profile.location,
          website: user.profile.website,
          linkedin: user.profile.linkedin,
          github: user.profile.github,
          createdAt: user.profile.createdAt,
          updatedAt: user.profile.updatedAt,
        } : undefined,
      })),
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

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      profile: user.profile ? {
        id: user.profile.id,
        userId: user.profile.userId,
        avatar: user.profile.avatar,
        headline: user.profile.headline,
        bio: user.profile.bio,
        skills: user.profile.skills,
        cvUrl: user.profile.cvUrl,
        location: user.profile.location,
        website: user.profile.website,
        linkedin: user.profile.linkedin,
        github: user.profile.github,
        createdAt: user.profile.createdAt,
        updatedAt: user.profile.updatedAt,
      } : undefined,
    };
  }
}
