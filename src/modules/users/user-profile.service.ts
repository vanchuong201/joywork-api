import { prisma } from '@/shared/database/prisma';
import { AppError } from '@/shared/errors/errorHandler';
import {
  UpdateProfileInput,
} from './users.schema';

// Helper: Generate slug from name
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-'); // Replace multiple hyphens with single
}

// Helper: Ensure unique slug
export async function ensureUniqueSlug(baseSlug: string, excludeUserId?: string): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await prisma.user.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existing || (excludeUserId && existing.id === excludeUserId)) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

export class UserProfileService {
  // Get public profile by slug (or ID as fallback)
  async getPublicProfileBySlug(slug: string): Promise<any | null> {
    // Try to find by slug first
    let user = await prisma.user.findUnique({
      where: { slug },
      include: {
        profile: true,
        experiences: {
          orderBy: [
            { order: 'asc' },
            { startDate: 'desc' },
          ],
        },
        educations: {
          orderBy: [
            { order: 'asc' },
            { startDate: 'desc' },
          ],
        },
      },
    });

    // If not found by slug, try to find by ID (for backward compatibility)
    if (!user) {
      user = await prisma.user.findUnique({
        where: { id: slug },
        include: {
          profile: true,
          experiences: {
            orderBy: [
              { order: 'asc' },
              { startDate: 'desc' },
            ],
          },
          educations: {
            orderBy: [
              { order: 'asc' },
              { startDate: 'desc' },
            ],
          },
        },
      });

      // If found by ID but user doesn't have slug, generate one
      if (user && !user.slug) {
        const baseName = user.name || user.email.split('@')[0] || 'user';
        const baseSlug = generateSlug(baseName);
        const newSlug = baseSlug 
          ? await ensureUniqueSlug(baseSlug, user.id)
          : await ensureUniqueSlug(`user-${user.id.substring(0, 8)}`, user.id);
        
        await prisma.user.update({
          where: { id: user.id },
          data: { slug: newSlug },
        });
        
        // Update the user object with new slug (need to cast to include slug)
        user = { ...user, slug: newSlug } as typeof user & { slug: string };
      }
    }

    if (!user) {
      return null;
    }

    // Check if profile is public
    if (user.profile && !user.profile.isPublic) {
      return null; // Profile is private
    }

    const visibility = (user.profile?.visibility as any) || {
      bio: true,
      experience: true,
      education: true,
      ksa: true,
      expectations: true,
    };

    const result: any = {
      id: user.id,
      name: user.name,
      slug: user.slug,
      // Email/Phone always hidden on public profile
      createdAt: user.createdAt,
    };

    if (user.profile) {
      result.profile = {
        id: user.profile.id,
        avatar: user.profile.avatar,
        title: user.profile.title,
        headline: user.profile.headline,
        location: user.profile.location,
        website: user.profile.website,
        linkedin: user.profile.linkedin,
        github: user.profile.github,
        status: user.profile.status,
        createdAt: user.profile.createdAt,
        updatedAt: user.profile.updatedAt,
      };

      // Only include visible sections
      if (visibility.bio && user.profile.bio) {
        result.profile.bio = user.profile.bio;
      }

      if (visibility.ksa) {
        if (user.profile.knowledge && user.profile.knowledge.length > 0) {
          result.profile.knowledge = user.profile.knowledge;
        }
        if (user.profile.skills && user.profile.skills.length > 0) {
          result.profile.skills = user.profile.skills;
        }
        if (user.profile.attitude && user.profile.attitude.length > 0) {
          result.profile.attitude = user.profile.attitude;
        }
      }

      if (visibility.expectations) {
        if (user.profile.expectedSalary) result.profile.expectedSalary = user.profile.expectedSalary;
        if (user.profile.workMode) result.profile.workMode = user.profile.workMode;
        if (user.profile.expectedCulture) result.profile.expectedCulture = user.profile.expectedCulture;
      }

      if (user.profile.careerGoals && user.profile.careerGoals.length > 0) {
        result.profile.careerGoals = user.profile.careerGoals;
      }
    }

    if (visibility.experience && user.experiences && user.experiences.length > 0) {
      result.experiences = user.experiences.map((exp: any) => ({
        id: exp.id,
        role: exp.role,
        company: exp.company,
        period: exp.period,
        desc: exp.desc,
        achievements: exp.achievements,
        startDate: exp.startDate,
        endDate: exp.endDate,
      }));
    }

    if (visibility.education && user.educations && user.educations.length > 0) {
      result.educations = user.educations.map((edu: any) => ({
        id: edu.id,
        school: edu.school,
        degree: edu.degree,
        period: edu.period,
        gpa: edu.gpa,
        honors: edu.honors,
        startDate: edu.startDate,
        endDate: edu.endDate,
      }));
    }

    return result;
  }

  // Get own profile (with full data including email/phone)
  async getOwnProfile(userId: string): Promise<any | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        experiences: {
          orderBy: [
            { order: 'asc' },
            { startDate: 'desc' },
          ],
        },
        educations: {
          orderBy: [
            { order: 'asc' },
            { startDate: 'desc' },
          ],
        },
      },
    });

    if (!user) {
      return null;
    }

    const result: any = {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      slug: user.slug,
      avatar: user.avatar, // Account avatar
      createdAt: user.createdAt,
      profile: user.profile ? {
        id: user.profile.id,
        avatar: user.profile.avatar,
        fullName: user.profile.fullName,
        title: user.profile.title,
        headline: user.profile.headline,
        bio: user.profile.bio,
        skills: user.profile.skills,
        cvUrl: user.profile.cvUrl,
        location: user.profile.location,
        website: user.profile.website,
        linkedin: user.profile.linkedin,
        github: user.profile.github,
        status: user.profile.status,
        isPublic: user.profile.isPublic,
        visibility: user.profile.visibility,
        knowledge: user.profile.knowledge,
        attitude: user.profile.attitude,
        expectedSalary: user.profile.expectedSalary,
        workMode: user.profile.workMode,
        expectedCulture: user.profile.expectedCulture,
        careerGoals: user.profile.careerGoals,
        createdAt: user.profile.createdAt,
        updatedAt: user.profile.updatedAt,
      } : null, // Always include profile (null if not exists)
      experiences: user.experiences.map((exp: any) => ({
        id: exp.id,
        role: exp.role,
        company: exp.company,
        startDate: exp.startDate,
        endDate: exp.endDate,
        period: exp.period,
        desc: exp.desc,
        achievements: exp.achievements,
        order: exp.order,
      })),
      educations: user.educations.map((edu: any) => ({
        id: edu.id,
        school: edu.school,
        degree: edu.degree,
        startDate: edu.startDate,
        endDate: edu.endDate,
        period: edu.period,
        gpa: edu.gpa,
        honors: edu.honors,
        order: edu.order,
      })),
    };

    return result;
  }

  // Update profile
  async updateProfile(userId: string, data: UpdateProfileInput): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const { name, slug, ...profileInput } = data;

    // Update user name and slug
    const userUpdateData: any = {};
    if (typeof name === 'string') {
      userUpdateData.name = name;
      // Auto-generate slug from name if not provided
      if (!slug && name) {
        const baseSlug = generateSlug(name);
        userUpdateData.slug = await ensureUniqueSlug(baseSlug, userId);
      }
    }
    if (typeof slug === 'string') {
      const uniqueSlug = await ensureUniqueSlug(slug, userId);
      userUpdateData.slug = uniqueSlug;
    }

    if (Object.keys(userUpdateData).length > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: userUpdateData,
      });
    }

    // Update or create profile
    const profileData: any = {
      updatedAt: new Date(),
    };

    // Map all profile fields
    const profileFields = [
      'avatar', 'fullName', 'headline', 'bio', 'skills', 'cvUrl', 'location',
      'website', 'linkedin', 'github', 'title', 'status', 'isPublic',
      'visibility', 'knowledge', 'attitude', 'expectedSalary',
      'workMode', 'expectedCulture', 'careerGoals',
    ];

    for (const field of profileFields) {
      if (profileInput[field as keyof typeof profileInput] !== undefined) {
        const value = profileInput[field as keyof typeof profileInput];
        profileData[field] = value ?? (field === 'skills' || field === 'knowledge' || field === 'attitude' || field === 'careerGoals' ? [] : null);
      }
    }

    await prisma.userProfile.upsert({
      where: { userId },
      update: profileData,
      create: {
        userId,
        ...profileData,
      },
    });

    return await this.getOwnProfile(userId);
  }
}

