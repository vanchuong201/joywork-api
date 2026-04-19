import { prisma } from '@/shared/database/prisma';
import { AppError } from '@/shared/errors/errorHandler';
import { getProvinceNameByCode } from '@/shared/provinces';
import { resolveLocationsWithWards } from '@/shared/wards';
import {
  UpdateProfileInput,
} from './users.schema';

const TALENT_POOL_FEATURE_KEY = 'TALENT_POOL';

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
  /**
   * Ẩn contactEmail / contactPhone / cvUrl / website / linkedin / github trên API public trừ khi:
   * - viewer là chủ hồ sơ, hoặc
   * - có companyId + viewer là OWNER/ADMIN công ty + đã có CvFlipConnection,
   * - hoặc ứng viên đã chủ động apply vào job của công ty đó (không cần mở CV).
   */
  private async shouldRedactPublicContactFields(params: {
    profileUserId: string;
    viewerUserId: string | null | undefined;
    companyId: string | null | undefined;
  }): Promise<boolean> {
    const { profileUserId, viewerUserId, companyId } = params;
    if (!viewerUserId) {
      return true;
    }
    if (viewerUserId === profileUserId) {
      return false;
    }
    const cid = typeof companyId === 'string' ? companyId.trim() : '';
    if (!cid) {
      return true;
    }

    const membership = await prisma.companyMember.findFirst({
      where: {
        userId: viewerUserId,
        companyId: cid,
        role: { in: ['OWNER', 'ADMIN'] },
      },
      select: { id: true },
    });
    if (!membership) {
      return true;
    }

    const hasAppliedToCompany = await prisma.application.findFirst({
      where: {
        userId: profileUserId,
        status: { not: 'REJECTED' },
        job: { companyId: cid },
      },
      select: { id: true },
    });
    if (hasAppliedToCompany) {
      return false;
    }

    const connection = await prisma.cvFlipConnection.findUnique({
      where: {
        companyId_userId: {
          companyId: cid,
          userId: profileUserId,
        },
      },
      select: { id: true },
    });

    return !connection;
  }

  /**
   * Cho phép DN (OWNER/ADMIN, công ty bật Talent Pool) xem shell hồ sơ ứng viên
   * đang ACTIVE trong Talent Pool dù `isPublic === false`, để khớp với list `/talent-pool/candidates`.
   * Contact vẫn qua `shouldRedactPublicContactFields`.
   */
  private async canViewerSeePrivateProfileViaTalentPool(params: {
    viewerUserId: string | null | undefined;
    profileUserId: string;
    companyId: string | null | undefined;
  }): Promise<boolean> {
    const { viewerUserId, profileUserId, companyId } = params;
    if (!viewerUserId || viewerUserId === profileUserId) {
      return false;
    }
    const cid = typeof companyId === 'string' ? companyId.trim() : '';
    if (!cid) {
      return false;
    }

    const membership = await prisma.companyMember.findFirst({
      where: {
        userId: viewerUserId,
        companyId: cid,
        role: { in: ['OWNER', 'ADMIN'] },
      },
      select: { id: true },
    });
    if (!membership) {
      return false;
    }

    const entitlement = await prisma.companyFeatureEntitlement.findUnique({
      where: {
        companyId_featureKey: {
          companyId: cid,
          featureKey: TALENT_POOL_FEATURE_KEY,
        },
      },
      select: { enabled: true },
    });
    if (!entitlement?.enabled) {
      return false;
    }

    const member = await prisma.talentPoolMember.findUnique({
      where: { userId: profileUserId },
      select: { status: true },
    });
    return member?.status === 'ACTIVE';
  }

  // Get public profile by slug (or ID as fallback).
  // Khi viewerUserId trùng chủ hồ sơ, vẫn trả về dù isPublic = false (xem trước khi đăng nhập).
  async getPublicProfileBySlug(
    slug: string,
    viewerUserId?: string | null,
    options?: { companyId?: string | null }
  ): Promise<any | null> {
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

    // Check if profile is public (chủ hồ sơ xem được khi đã đăng nhập)
    if (user.profile && !user.profile.isPublic) {
      if (!viewerUserId || viewerUserId !== user.id) {
        const allowTalentPoolEmployer = await this.canViewerSeePrivateProfileViaTalentPool({
          viewerUserId,
          profileUserId: user.id,
          companyId: options?.companyId ?? null,
        });
        if (!allowTalentPoolEmployer) {
          return null;
        }
      }
    }

    const visibility = (user.profile?.visibility as any) || {
      bio: true,
      experience: true,
      education: true,
      ksa: true,
      expectations: true,
    };

    const talentPoolMember = await prisma.talentPoolMember.findUnique({
      where: { userId: user.id },
      select: { status: true },
    });

    const result: any = {
      id: user.id,
      name: user.name,
      slug: user.slug,
      createdAt: user.createdAt,
      isTalentPoolMember: talentPoolMember?.status === 'ACTIVE',
    };

    if (user.profile) {
      result.profile = {
        id: user.profile.id,
        avatar: user.profile.avatar,
        fullName: user.profile.fullName,
        title: user.profile.title,
        headline: user.profile.headline,
        locations: user.profile.locations,
        wardCodes: user.profile.wardCodes,
        ...(user.profile.locations.length > 0 ? { location: getProvinceNameByCode(user.profile.locations[0]) ?? user.profile.locations[0] } : {}),
        website: user.profile.website,
        linkedin: user.profile.linkedin,
        github: user.profile.github,
        cvUrl: user.profile.cvUrl,
        contactEmail: user.profile.contactEmail,
        contactPhone: user.profile.contactPhone,
        status: user.profile.status,
        isSearchingJob: user.profile.isSearchingJob,
        allowCvFlip: user.profile.allowCvFlip,
        gender: user.profile.gender,
        yearOfBirth: user.profile.yearOfBirth,
        educationLevel: user.profile.educationLevel,
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
        if (user.profile.expectedSalaryMin != null) result.profile.expectedSalaryMin = user.profile.expectedSalaryMin;
        if (user.profile.expectedSalaryMax != null) result.profile.expectedSalaryMax = user.profile.expectedSalaryMax;
        if (user.profile.salaryCurrency) result.profile.salaryCurrency = user.profile.salaryCurrency;
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

    const redactContacts = await this.shouldRedactPublicContactFields({
      profileUserId: user.id,
      viewerUserId: viewerUserId ?? null,
      companyId: options?.companyId ?? null,
    });
    if (redactContacts && result.profile) {
      result.profile.contactEmail = null;
      result.profile.contactPhone = null;
      result.profile.cvUrl = null;
      result.profile.website = null;
      result.profile.linkedin = null;
      result.profile.github = null;
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
      emailVerified: user.emailVerified, // Include email verification status
      phone: user.phone,
      name: user.name,
      slug: user.slug,
      avatar: user.avatar, // Account avatar
      createdAt: user.createdAt,
      profile: user.profile
        ? {
            id: user.profile.id,
            avatar: user.profile.avatar,
            fullName: user.profile.fullName,
            title: user.profile.title,
            headline: user.profile.headline,
            bio: user.profile.bio,
            skills: user.profile.skills,
            cvUrl: user.profile.cvUrl,
            locations: user.profile.locations,
            wardCodes: user.profile.wardCodes,
            ...(user.profile.locations.length > 0 ? { location: getProvinceNameByCode(user.profile.locations[0]) ?? user.profile.locations[0] } : {}),
            website: user.profile.website,
            linkedin: user.profile.linkedin,
            github: user.profile.github,
            // CV contact info (independent from account email/phone)
            contactEmail: (user.profile as any).contactEmail,
            contactPhone: (user.profile as any).contactPhone,
            status: user.profile.status,
            isPublic: user.profile.isPublic,
            isSearchingJob: user.profile.isSearchingJob,
            allowCvFlip: user.profile.allowCvFlip,
            visibility: user.profile.visibility,
            knowledge: user.profile.knowledge,
            attitude: user.profile.attitude,
            expectedSalaryMin: user.profile.expectedSalaryMin,
            expectedSalaryMax: user.profile.expectedSalaryMax,
            salaryCurrency: user.profile.salaryCurrency,
            workMode: user.profile.workMode,
            expectedCulture: user.profile.expectedCulture,
            careerGoals: user.profile.careerGoals,
            gender: user.profile.gender,
            yearOfBirth: user.profile.yearOfBirth,
            educationLevel: user.profile.educationLevel,
            createdAt: user.profile.createdAt,
            updatedAt: user.profile.updatedAt,
          }
        : null, // Always include profile (null if not exists)
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
      'avatar',
      'fullName',
      'headline',
      'bio',
      'skills',
      'cvUrl',
      'website',
      'linkedin',
      'github',
      // CV contact info
      'contactEmail',
      'contactPhone',
      'title',
      'status',
      'isPublic',
      'isSearchingJob',
      'allowCvFlip',
      'visibility',
      'knowledge',
      'attitude',
      'expectedSalaryMin',
      'expectedSalaryMax',
      'salaryCurrency',
      'workMode',
      'expectedCulture',
      'careerGoals',
      'gender',
      'yearOfBirth',
      'educationLevel',
    ];

    for (const field of profileFields) {
      if (profileInput[field as keyof typeof profileInput] !== undefined) {
        const value = profileInput[field as keyof typeof profileInput];
        profileData[field] = value ?? (field === 'skills' || field === 'knowledge' || field === 'attitude' || field === 'careerGoals' ? [] : null);
      }
    }

    if (
      profileInput.locations !== undefined ||
      profileInput.location !== undefined ||
      profileInput.wardCodes !== undefined
    ) {
      const existing = await prisma.userProfile.findUnique({
        where: { userId },
        select: { locations: true, wardCodes: true },
      });
      const locInput: { locations?: string[]; location?: string | null; wardCodes?: string[] } = {};
      if (profileInput.locations !== undefined) locInput.locations = profileInput.locations;
      if (profileInput.location !== undefined) locInput.location = profileInput.location;
      if (profileInput.wardCodes !== undefined) locInput.wardCodes = profileInput.wardCodes;
      const resolved = resolveLocationsWithWards(existing, locInput);
      profileData.locations = resolved.locations;
      profileData.wardCodes = resolved.wardCodes;
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

