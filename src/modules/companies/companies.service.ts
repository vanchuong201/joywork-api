import { Prisma } from '@prisma/client';
import { prisma } from '@/shared/database/prisma';
import { AppError } from '@/shared/errors/errorHandler';
import {
  CreateCompanyInput,
  UpdateCompanyInput,
  SearchCompaniesInput,
  AddCompanyMemberInput,
  UpdateCompanyMemberInput,
  UpdateCompanyProfileInput,
} from './companies.schema';
import crypto from 'crypto';
import { emailService } from '@/shared/services/email.service';
import { config } from '@/config/env';

export interface Company {
  id: string;
  name: string;
  legalName?: string | null;
  slug: string;
  tagline?: string;
  description?: string;
  logoUrl?: string;
  coverUrl?: string;
  website?: string;
  location?: string;
  industry?: string;
  size?: string;
  foundedYear?: number;
  headcount?: number;
  headcountNote?: string;
  metrics?: CompanyMetric[];
  profileStory?: CompanyStoryBlock[];
  highlights?: CompanyHighlight[];
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanyMetric {
  label: string;
  value: string;
  description?: string;
  icon?: string;
}

export interface CompanyStoryStat {
  label: string;
  value: string;
  description?: string;
}

export interface CompanyStoryMediaItem {
  url: string;
  caption?: string;
}

export interface CompanyStoryBlock {
  id?: string;
  type: 'text' | 'list' | 'quote' | 'stats' | 'media';
  title?: string;
  subtitle?: string;
  body?: string;
  items?: string[];
  stats?: CompanyStoryStat[];
  quote?: {
    text: string;
    author?: string;
    role?: string;
  };
  media?: CompanyStoryMediaItem[];
}

export interface CompanyHighlight {
  label: string;
  description?: string;
}

export interface CompanyProfile {
  stats?: any;
  vision?: string;
  mission?: string;
  coreValues?: string;
  products?: any;
  recruitmentPrinciples?: any;
  benefits?: any;
  hrJourney?: any;
  careerPath?: any;
  salaryAndBonus?: any;
  training?: any;
  leaders?: any;
  story?: any;
  culture?: any;
  awards?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanyWithMembers {
  id: string;
  name: string;
  legalName?: string | null;
  slug: string;
  tagline?: string;
  description?: string;
  logoUrl?: string;
  coverUrl?: string;
  website?: string;
  location?: string;
  industry?: string;
  size?: string;
  foundedYear?: number;
  headcount?: number;
  headcountNote?: string;
  metrics?: CompanyMetric[];
  profileStory?: CompanyStoryBlock[];
  highlights?: CompanyHighlight[];
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  members: Array<{
    id: string;
    userId: string;
    role: string;
    joinedAt: Date;
    user: {
      id: string;
      email: string;
      name?: string;
    };
  }>;
  stats?: {
    posts: number;
    jobs: number;
    followers: number;
  };
  profile?: CompanyProfile | null;
}

export interface CompanyMembershipSummary {
  membershipId: string;
  role: string;
  company: Company;
}

export interface CompanyFollowSummary {
  followId: string;
  followedAt: Date;
  company: Company;
}

export interface CompanySummary {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  tagline?: string;
  location?: string;
  followersCount: number;
  jobsActive: number;
  postsCount: number;
}

export class CompaniesService {
  // Create company
  async createCompany(userId: string, data: CreateCompanyInput): Promise<Company> {
    // Check if slug already exists
    const existingCompany = await prisma.company.findUnique({
      where: { slug: data.slug },
    });

    if (existingCompany) {
      throw new AppError('Company with this slug already exists', 409, 'SLUG_EXISTS');
    }

    // Create company
    const { metrics, profileStory, highlights, ...rest } = data;

    // Omit undefined properties to satisfy exactOptionalPropertyTypes
    const baseData = Object.fromEntries(
      Object.entries(rest).filter(([, v]) => v !== undefined)
    );

    const company = await prisma.company.create({
      data: {
        ...(baseData as any),
        ...(metrics !== undefined ? { metrics: metrics as Prisma.InputJsonValue } : {}),
        ...(profileStory !== undefined ? { profileStory: profileStory as Prisma.InputJsonValue } : {}),
        ...(highlights !== undefined ? { highlights: highlights as Prisma.InputJsonValue } : {}),
      },
    });

    // Add user as owner
    await prisma.companyMember.create({
      data: {
        userId,
        companyId: company.id,
        role: 'OWNER',
      },
    });

    // Create default empty profile
    await prisma.companyProfile.create({
        data: { companyId: company.id }
    });

    return {
      id: company.id,
      name: company.name,
      legalName: company.legalName,
      slug: company.slug,
      ...(company.tagline != null ? { tagline: company.tagline } : {}),
      ...(company.description != null ? { description: company.description } : {}),
      ...(company.logoUrl != null ? { logoUrl: company.logoUrl } : {}),
      ...(company.coverUrl != null ? { coverUrl: company.coverUrl } : {}),
      ...(company.website != null ? { website: company.website } : {}),
      ...(company.location != null ? { location: company.location } : {}),
      ...(company.industry != null ? { industry: company.industry } : {}),
      ...(company.size != null ? { size: company.size } : {}),
      ...(company.foundedYear != null ? { foundedYear: company.foundedYear } : {}),
      ...(company.headcount != null ? { headcount: company.headcount } : {}),
      ...(company.headcountNote != null ? { headcountNote: company.headcountNote } : {}),
      ...(company.metrics != null ? { metrics: company.metrics as unknown as CompanyMetric[] } : {}),
      ...(company.profileStory != null ? { profileStory: company.profileStory as unknown as CompanyStoryBlock[] } : {}),
      ...(company.highlights != null ? { highlights: company.highlights as unknown as CompanyHighlight[] } : {}),
      isVerified: company.isVerified,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
    };
  }

  // List followers of a company (members only)
  async listCompanyFollowers(requesterId: string, companyId: string, page = 1, limit = 20) {
    // Ensure requester is a member (any role)
    const membership = await prisma.companyMember.findFirst({
      where: { userId: requesterId, companyId },
      select: { id: true },
    });
    if (!membership) {
      throw new AppError('You do not have permission to view followers', 403, 'FORBIDDEN');
    }

    const [total, items] = await Promise.all([
      prisma.follow.count({ where: { companyId } }),
      prisma.follow.findMany({
        where: { companyId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              profile: { select: { avatar: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const followers = items.map((f) => ({
      followedAt: f.createdAt,
      user: {
        id: f.user.id,
        email: f.user.email,
        name: f.user.name ?? null,
        avatar: f.user.profile?.avatar ?? null,
      },
    }));

    return {
      followers,
      pagination: {
        page,
        limit,
        total,
        hasMore: page * limit < total,
      },
    };
  }
  // Update company
  async updateCompany(companyId: string, userId: string, data: UpdateCompanyInput): Promise<Company> {
    // Check if user is owner/admin of company
    const membership = await prisma.companyMember.findFirst({
      where: {
        userId,
        companyId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!membership) {
      throw new AppError('You do not have permission to update this company', 403, 'FORBIDDEN');
    }

    // Check if new slug conflicts (if provided)
    if (data['slug']) {
      const existingCompany = await prisma.company.findFirst({
        where: {
          slug: data['slug'],
          id: { not: companyId },
        },
      });

      if (existingCompany) {
        throw new AppError('Company with this slug already exists', 409, 'SLUG_EXISTS');
      }
    }

    // Update company
    const { metrics, profileStory, highlights, ...rest } = data;

    // Omit undefined properties to satisfy exactOptionalPropertyTypes
    const updateBase = Object.fromEntries(
      Object.entries(rest).filter(([, v]) => v !== undefined)
    );

    const company = await prisma.company.update({
      where: { id: companyId },
      data: {
        ...(updateBase as any),
        ...(metrics !== undefined ? { metrics: metrics as Prisma.InputJsonValue } : {}),
        ...(profileStory !== undefined ? { profileStory: profileStory as Prisma.InputJsonValue } : {}),
        ...(highlights !== undefined ? { highlights: highlights as Prisma.InputJsonValue } : {}),
        updatedAt: new Date(),
      },
    });

    return {
      id: company.id,
      name: company.name,
      legalName: company.legalName,
      slug: company.slug,
      ...(company.tagline != null ? { tagline: company.tagline } : {}),
      ...(company.description != null ? { description: company.description } : {}),
      ...(company.logoUrl != null ? { logoUrl: company.logoUrl } : {}),
      ...(company.coverUrl != null ? { coverUrl: company.coverUrl } : {}),
      ...(company.website != null ? { website: company.website } : {}),
      ...(company.location != null ? { location: company.location } : {}),
      ...(company.industry != null ? { industry: company.industry } : {}),
      ...(company.size != null ? { size: company.size } : {}),
      ...(company.foundedYear != null ? { foundedYear: company.foundedYear } : {}),
      ...(company.headcount != null ? { headcount: company.headcount } : {}),
      ...(company.headcountNote != null ? { headcountNote: company.headcountNote } : {}),
      ...(company.metrics != null ? { metrics: company.metrics as unknown as CompanyMetric[] } : {}),
      ...(company.profileStory != null ? { profileStory: company.profileStory as unknown as CompanyStoryBlock[] } : {}),
      ...(company.highlights != null ? { highlights: company.highlights as unknown as CompanyHighlight[] } : {}),
      isVerified: company.isVerified,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
    };
  }

  // Get company by slug
  async getCompanyBySlug(slug: string): Promise<CompanyWithMembers | null> {
    const company = await prisma.company.findUnique({
      where: { slug },
      include: {
        profile: true, // Include profile
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                profile: { select: { avatar: true } },
              },
            },
          },
        },
        _count: {
          select: {
            posts: true,
            jobs: true,
            follows: true,
          },
        },
      },
    });

    if (!company) {
      return null;
    }

    // Ensure profile exists if not (lazy create) or just return null
    // Better to just return what we have
    const profile = company.profile ? {
        stats: company.profile.stats as any,
        vision: company.profile.vision ?? undefined,
        mission: company.profile.mission ?? undefined,
        coreValues: company.profile.coreValues ?? undefined,
        products: company.profile.products as any,
        recruitmentPrinciples: company.profile.recruitmentPrinciples as any,
        benefits: company.profile.benefits as any,
        hrJourney: company.profile.hrJourney as any,
        careerPath: company.profile.careerPath as any,
        salaryAndBonus: company.profile.salaryAndBonus as any,
        training: company.profile.training as any,
        leaders: company.profile.leaders as any,
        story: company.profile.story as any,
        culture: company.profile.culture as any,
        awards: company.profile.awards as any,
        createdAt: company.profile.createdAt,
        updatedAt: company.profile.updatedAt
    } : null;

    return {
      id: company.id,
      name: company.name,
      legalName: company.legalName,
      slug: company.slug,
      ...(company.tagline != null ? { tagline: company.tagline } : {}),
      ...(company.description != null ? { description: company.description } : {}),
      ...(company.logoUrl != null ? { logoUrl: company.logoUrl } : {}),
      ...(company.coverUrl != null ? { coverUrl: company.coverUrl } : {}),
      ...(company.website != null ? { website: company.website } : {}),
      ...(company.location != null ? { location: company.location } : {}),
      ...(company.industry != null ? { industry: company.industry } : {}),
      ...(company.size != null ? { size: company.size } : {}),
      ...(company.foundedYear != null ? { foundedYear: company.foundedYear } : {}),
      ...(company.headcount != null ? { headcount: company.headcount } : {}),
      ...(company.headcountNote != null ? { headcountNote: company.headcountNote } : {}),
      ...(company.metrics != null ? { metrics: company.metrics as unknown as CompanyMetric[] } : {}),
      ...(company.profileStory != null ? { profileStory: company.profileStory as unknown as CompanyStoryBlock[] } : {}),
      ...(company.highlights != null ? { highlights: company.highlights as unknown as CompanyHighlight[] } : {}),
      isVerified: company.isVerified,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
      members: company.members.map(member => ({
        id: member.id,
        userId: member.userId,
        role: member.role,
        joinedAt: member.joinedAt,
        user: {
          id: member.user.id,
          email: member.user.email,
          ...(member.user.name != null ? { name: member.user.name } : {}),
          avatar: member.user.profile?.avatar ?? null,
        },
      })),
      ...(company._count ? {
        stats: {
        posts: company._count.posts,
        jobs: company._count.jobs,
        followers: company._count.follows,
        },
      } : {}),
      profile,
    };
  }

  async updateCompanyProfile(companyId: string, userId: string, data: UpdateCompanyProfileInput) {
    // Check permission
    const membership = await prisma.companyMember.findFirst({
        where: {
            userId,
            companyId,
            role: { in: ['OWNER', 'ADMIN'] }
        }
    });

    if (!membership) {
        throw new AppError('You do not have permission to update profile', 403, 'FORBIDDEN');
    }

    // Omit undefined
    const cleanData = Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== undefined)
    );

    const profile = await prisma.companyProfile.upsert({
        where: { companyId },
        create: {
            companyId,
            ...(cleanData as any)
        },
        update: {
            ...(cleanData as any),
            updatedAt: new Date()
        }
    });

    return profile;
  }

  // Search companies
  async searchCompanies(data: SearchCompaniesInput): Promise<{
    companies: Company[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const { q, industry, location, size, page, limit } = data;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { tagline: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (industry) {
      where.industry = { contains: industry, mode: 'insensitive' };
    }

    if (location) {
      where.location = { contains: location, mode: 'insensitive' };
    }

    if (size) {
      where.size = size;
    }

    // Get companies with pagination
    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.company.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      companies: companies.map(company => ({
        id: company.id,
        name: company.name,
        legalName: company.legalName,
        slug: company.slug,
        ...(company.tagline != null ? { tagline: company.tagline } : {}),
        ...(company.description != null ? { description: company.description } : {}),
        ...(company.logoUrl != null ? { logoUrl: company.logoUrl } : {}),
        ...(company.coverUrl != null ? { coverUrl: company.coverUrl } : {}),
        ...(company.website != null ? { website: company.website } : {}),
        ...(company.location != null ? { location: company.location } : {}),
        ...(company.industry != null ? { industry: company.industry } : {}),
        ...(company.size != null ? { size: company.size } : {}),
        ...(company.foundedYear != null ? { foundedYear: company.foundedYear } : {}),
        isVerified: company.isVerified,
        createdAt: company.createdAt,
        updatedAt: company.updatedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  // Get user's companies
  async getUserCompanies(userId: string): Promise<CompanyMembershipSummary[]> {
    const memberships = await prisma.companyMember.findMany({
      where: { userId },
      include: {
        company: true,
      },
      orderBy: { joinedAt: 'desc' },
    });

    return memberships.map(membership => ({
      membershipId: membership.id,
      role: membership.role,
      company: {
        id: membership.company.id,
        name: membership.company.name,
        legalName: membership.company.legalName,
        slug: membership.company.slug,
        ...(membership.company.tagline != null ? { tagline: membership.company.tagline } : {}),
        ...(membership.company.description != null ? { description: membership.company.description } : {}),
        ...(membership.company.logoUrl != null ? { logoUrl: membership.company.logoUrl } : {}),
        ...(membership.company.coverUrl != null ? { coverUrl: membership.company.coverUrl } : {}),
        ...(membership.company.website != null ? { website: membership.company.website } : {}),
        ...(membership.company.location != null ? { location: membership.company.location } : {}),
        ...(membership.company.industry != null ? { industry: membership.company.industry } : {}),
        ...(membership.company.size != null ? { size: membership.company.size } : {}),
        ...(membership.company.foundedYear != null ? { foundedYear: membership.company.foundedYear } : {}),
        ...(membership.company.headcount != null ? { headcount: membership.company.headcount } : {}),
        ...(membership.company.headcountNote != null ? { headcountNote: membership.company.headcountNote } : {}),
        ...(membership.company.metrics != null ? { metrics: membership.company.metrics as unknown as CompanyMetric[] } : {}),
        ...(membership.company.profileStory != null ? { profileStory: membership.company.profileStory as unknown as CompanyStoryBlock[] } : {}),
        ...(membership.company.highlights != null ? { highlights: membership.company.highlights as unknown as CompanyHighlight[] } : {}),
        isVerified: membership.company.isVerified,
        createdAt: membership.company.createdAt,
        updatedAt: membership.company.updatedAt,
      },
    }));
  }

  // Get companies the user follows
  async getUserFollows(userId: string): Promise<CompanyFollowSummary[]> {
    const follows = await prisma.follow.findMany({
      where: { userId },
      include: {
        company: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return follows.map(follow => ({
      followId: follow.id,
      followedAt: follow.createdAt,
      company: {
        id: follow.company.id,
        name: follow.company.name,
        legalName: follow.company.legalName,
        slug: follow.company.slug,
        ...(follow.company.tagline != null ? { tagline: follow.company.tagline } : {}),
        ...(follow.company.description != null ? { description: follow.company.description } : {}),
        ...(follow.company.logoUrl != null ? { logoUrl: follow.company.logoUrl } : {}),
        ...(follow.company.coverUrl != null ? { coverUrl: follow.company.coverUrl } : {}),
        ...(follow.company.website != null ? { website: follow.company.website } : {}),
        ...(follow.company.location != null ? { location: follow.company.location } : {}),
        ...(follow.company.industry != null ? { industry: follow.company.industry } : {}),
        ...(follow.company.size != null ? { size: follow.company.size } : {}),
        ...(follow.company.foundedYear != null ? { foundedYear: follow.company.foundedYear } : {}),
        ...(follow.company.headcount != null ? { headcount: follow.company.headcount } : {}),
        ...(follow.company.headcountNote != null ? { headcountNote: follow.company.headcountNote } : {}),
        ...(follow.company.metrics != null ? { metrics: follow.company.metrics as unknown as CompanyMetric[] } : {}),
        ...(follow.company.profileStory != null ? { profileStory: follow.company.profileStory as unknown as CompanyStoryBlock[] } : {}),
        ...(follow.company.highlights != null ? { highlights: follow.company.highlights as unknown as CompanyHighlight[] } : {}),
        isVerified: follow.company.isVerified,
        createdAt: follow.company.createdAt,
        updatedAt: follow.company.updatedAt,
      },
    }));
  }

  // Invite company member
  async inviteMember(companyId: string, ownerId: string, data: AddCompanyMemberInput): Promise<void> {
    // Check if user is owner/admin of company
    const membership = await prisma.companyMember.findFirst({
      where: {
        userId: ownerId,
        companyId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
      include: {
        user: true,
      },
    });

    if (!membership) {
      throw new AppError('You do not have permission to invite members', 403, 'FORBIDDEN');
    }

    // Role constraints: Admin cannot invite Owner or another Admin (depending on rules)
    // Here we allow Admin to invite Member, Owner to invite Admin/Member
    if (membership.role === 'ADMIN' && data.role !== 'MEMBER') {
       throw new AppError('Admins can only invite Members', 403, 'FORBIDDEN');
    }

    // Check if user is already a member
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      const existingMembership = await prisma.companyMember.findUnique({
        where: {
          userId_companyId: {
            userId: existingUser.id,
            companyId,
          },
        },
      });

      if (existingMembership) {
        throw new AppError('User is already a member of this company', 409, 'MEMBER_EXISTS');
      }
    }

    // Create invitation
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    // Check existing invitation and delete if exists
    await prisma.companyInvitation.deleteMany({
        where: {
            companyId,
            email: data.email
        }
    });

    await prisma.companyInvitation.create({
      data: {
        email: data.email,
        companyId,
        role: data.role,
        token,
        inviterId: ownerId,
        expiresAt,
      },
    });

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');

    const acceptUrl = `${config.FRONTEND_ORIGIN}/invitations/accept?token=${token}`;

    await emailService.sendCompanyInvitationEmail(
      data.email,
      company.name,
      membership.user.name || membership.user.email,
      data.role,
      acceptUrl
    );
  }

  // Accept invitation
  async acceptInvitation(token: string, userId: string): Promise<{ companySlug: string }> {
    const invitation = await prisma.companyInvitation.findUnique({
      where: { token },
      include: { company: true },
    });

    if (!invitation) {
      throw new AppError('Invalid or expired invitation', 404, 'INVITATION_INVALID');
    }

    if (invitation.expiresAt < new Date()) {
      throw new AppError('Invitation expired', 400, 'INVITATION_EXPIRED');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (user.email !== invitation.email) {
      throw new AppError('Email mismatch. Please login with the invited email.', 403, 'EMAIL_MISMATCH');
    }

    // Check if already member
    const existingMembership = await prisma.companyMember.findUnique({
      where: {
        userId_companyId: {
          userId,
          companyId: invitation.companyId,
        },
      },
    });

    if (existingMembership) {
        // Already member, just clean up invite
        await prisma.companyInvitation.delete({ where: { id: invitation.id } });
        return { companySlug: invitation.company.slug };
    }

    // Add member
    await prisma.companyMember.create({
      data: {
        userId,
        companyId: invitation.companyId,
        role: invitation.role,
      },
    });

    // Delete invitation
    await prisma.companyInvitation.delete({
      where: { id: invitation.id },
    });

    return { companySlug: invitation.company.slug };
  }

  // Get invitation details (for frontend preview)
  async getInvitation(token: string): Promise<{
    email: string;
    companyName: string;
    inviterName: string;
    role: string;
  }> {
     const invitation = await prisma.companyInvitation.findUnique({
      where: { token },
      include: { 
          company: true,
          inviter: true
      },
    });

    if (!invitation) {
      throw new AppError('Invalid or expired invitation', 404, 'INVITATION_INVALID');
    }
    
    if (invitation.expiresAt < new Date()) {
        throw new AppError('Invitation expired', 400, 'INVITATION_EXPIRED');
    }

    return {
        email: invitation.email,
        companyName: invitation.company.name,
        inviterName: invitation.inviter.name || invitation.inviter.email,
        role: invitation.role
    };
  }

  // Update company member role
  async updateCompanyMemberRole(companyId: string, memberId: string, ownerId: string, data: UpdateCompanyMemberInput): Promise<void> {
    // Check if user is owner/admin of company
    const membership = await prisma.companyMember.findFirst({
      where: {
        userId: ownerId,
        companyId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!membership) {
      throw new AppError('You do not have permission to update members', 403, 'FORBIDDEN');
    }
    
    const targetMember = await prisma.companyMember.findUnique({
        where: { id: memberId }
    });

    if (!targetMember) {
        throw new AppError('Member not found', 404, 'MEMBER_NOT_FOUND');
    }

    // OWNER can update anyone except themselves (logic handled in frontend mostly, but good to check)
    // ADMIN can update MEMBER only
    
    if (membership.role === 'ADMIN') {
        if (targetMember.role !== 'MEMBER') {
            throw new AppError('Admins can only update Members', 403, 'FORBIDDEN');
        }
        if (data.role !== 'MEMBER') { // Admin cannot promote to Admin/Owner
             // Actually, the requirement says "Admin được invite người khác làm admin hoặc member".
             // But for update role: "Owner có quyền cao nhất nên được phép xóa hoặc thay đổi quyền của Admin" implies Admin might be restricted.
             // Let's stick to standard: Admin manages Member.
             throw new AppError('Admins cannot change roles to Admin/Owner', 403, 'FORBIDDEN');
        }
    }

    // Owner cannot change someone else to Owner (ownership transfer is different process usually)
    if (data.role === 'OWNER') {
         throw new AppError('Ownership transfer is not supported via this endpoint', 400, 'INVALID_OPERATION');
    }

    // Update member role
    await prisma.companyMember.update({
      where: { id: memberId },
      data: { role: data.role },
    });
  }

  // Remove company member
  async removeCompanyMember(companyId: string, memberId: string, ownerId: string): Promise<void> {
    // Check if user is owner/admin of company
    const membership = await prisma.companyMember.findFirst({
      where: {
        userId: ownerId,
        companyId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!membership) {
      throw new AppError('You do not have permission to remove members', 403, 'FORBIDDEN');
    }

    const targetMember = await prisma.companyMember.findUnique({
        where: { id: memberId }
    });

    if (!targetMember) {
        throw new AppError('Member not found', 404, 'MEMBER_NOT_FOUND');
    }
    
    // Logic permissions
    if (membership.role === 'ADMIN') {
        if (targetMember.role !== 'MEMBER') {
             throw new AppError('Admins can only remove Members', 403, 'FORBIDDEN');
        }
    }
    
    if (targetMember.userId === ownerId) {
         throw new AppError('Cannot remove yourself', 400, 'INVALID_OPERATION');
    }

    // Remove member
    await prisma.companyMember.delete({
      where: { id: memberId },
    });
  }

  // Leave company
  async leaveCompany(companyId: string, userId: string): Promise<void> {
    const membership = await prisma.companyMember.findFirst({
      where: {
        userId,
        companyId,
      },
    });

    if (!membership) {
      throw new AppError('You are not a member of this company', 404, 'MEMBER_NOT_FOUND');
    }

    if (membership.role === 'OWNER') {
      throw new AppError('Owners cannot leave the company. Please transfer ownership or delete the company.', 400, 'OWNER_CANNOT_LEAVE');
    }

    await prisma.companyMember.delete({
      where: { id: membership.id },
    });
  }

  async followCompany(companyId: string, userId: string): Promise<void> {
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
    }

    const existing = await prisma.follow.findUnique({
      where: {
        userId_companyId: {
          userId,
          companyId,
        },
      },
    });

    if (existing) {
      throw new AppError('Already following this company', 409, 'ALREADY_FOLLOWING');
    }

    await prisma.follow.create({
      data: {
        userId,
        companyId,
      },
    });
  }

  async unfollowCompany(companyId: string, userId: string): Promise<void> {
    const follow = await prisma.follow.findUnique({
      where: {
        userId_companyId: {
          userId,
          companyId,
        },
      },
    });

    if (!follow) {
      throw new AppError('You are not following this company', 404, 'FOLLOW_NOT_FOUND');
    }

    await prisma.follow.delete({
      where: { id: follow.id },
    });
  }

  async getCompanySummary(companyIdOrSlug: string): Promise<CompanySummary | null> {
    let company = await prisma.company.findUnique({
      where: { id: companyIdOrSlug },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        tagline: true,
        location: true,
      },
    });

    if (!company) {
      company = await prisma.company.findUnique({
        where: { slug: companyIdOrSlug },
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          tagline: true,
          location: true,
        },
      });
    }

    if (!company) {
      return null;
    }

    const [followersCount, postsCount, jobsActive] = await Promise.all([
      prisma.follow.count({ where: { companyId: company.id } }),
      prisma.post.count({ where: { companyId: company.id, visibility: 'PUBLIC' } }),
      prisma.job.count({
        where: {
          companyId: company.id,
          isActive: true,
        },
      }),
    ]);

    return {
      id: company.id,
      name: company.name,
      slug: company.slug,
      ...(company.logoUrl ? { logoUrl: company.logoUrl } : {}),
      ...(company.tagline ? { tagline: company.tagline } : {}),
      ...(company.location ? { location: company.location } : {}),
      followersCount,
      postsCount,
      jobsActive,
    };
  }
}
