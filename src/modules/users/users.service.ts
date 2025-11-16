import { prisma } from '@/shared/database/prisma';
import { AppError } from '@/shared/errors/errorHandler';
import {
  UpdateProfileInput,
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

    const result: any = {
      id: user.id,
      email: user.email,
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
      if (user.profile.cvUrl) result.profile.cvUrl = user.profile.cvUrl;
      if (user.profile.location) result.profile.location = user.profile.location;
      if (user.profile.website) result.profile.website = user.profile.website;
      if (user.profile.linkedin) result.profile.linkedin = user.profile.linkedin;
      if (user.profile.github) result.profile.github = user.profile.github;
    }
    
    return result;
  }

  // Update user profile
  async updateProfile(userId: string, data: UpdateProfileInput): Promise<UserWithProfile> {
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const { name, ...profileInput } = data;

    if (typeof name === 'string') {
      await prisma.user.update({
        where: { id: userId },
        data: { name },
      });
    }

    // Update or create profile
    const profileData: any = {
      updatedAt: new Date(),
    };
    
    if (profileInput.avatar !== undefined) profileData.avatar = profileInput.avatar ?? null;
    if (profileInput.headline !== undefined) profileData.headline = profileInput.headline ?? null;
    if (profileInput.bio !== undefined) profileData.bio = profileInput.bio ?? null;
    if (profileInput.skills !== undefined) profileData.skills = profileInput.skills;
    if (profileInput.cvUrl !== undefined) profileData.cvUrl = profileInput.cvUrl ?? null;
    if (profileInput.location !== undefined) profileData.location = profileInput.location ?? null;
    if (profileInput.website !== undefined) profileData.website = profileInput.website ?? null;
    if (profileInput.linkedin !== undefined) profileData.linkedin = profileInput.linkedin ?? null;
    if (profileInput.github !== undefined) profileData.github = profileInput.github ?? null;
    
    await prisma.userProfile.upsert({
      where: { userId },
      update: profileData,
      create: {
        userId,
        ...profileData,
      },
    });

    const updated = await this.getUserProfile(userId);

    if (!updated) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    return updated;
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
      users: users.map(user => {
        const result: any = {
          id: user.id,
          email: user.email,
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
          if (user.profile.cvUrl) result.profile.cvUrl = user.profile.cvUrl;
          if (user.profile.location) result.profile.location = user.profile.location;
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
      email: user.email,
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
      if (user.profile.cvUrl) result.profile.cvUrl = user.profile.cvUrl;
      if (user.profile.location) result.profile.location = user.profile.location;
      if (user.profile.website) result.profile.website = user.profile.website;
      if (user.profile.linkedin) result.profile.linkedin = user.profile.linkedin;
      if (user.profile.github) result.profile.github = user.profile.github;
    }
    
    return result;
  }
}
