import { Prisma, CompanyStatementAnswer } from '@prisma/client';
import { prisma } from '@/shared/database/prisma';
import { AppError } from '@/shared/errors/errorHandler';
import {
  CreateCompanyInput,
  UpdateCompanyInput,
  SearchCompaniesInput,
  AddCompanyMemberInput,
  UpdateCompanyMemberInput,
  UpdateCompanyProfileInput,
  UploadVerificationContactsCsvInput,
  SendCompanyStatementsInput,
} from './companies.schema';
import crypto from 'crypto';
import { emailService } from '@/shared/services/email.service';
import { config } from '@/config/env';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { buildS3ObjectUrl, getS3BucketName, s3Client } from '@/shared/storage/s3';

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
  leadershipPhilosophy?: any;
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
  private async ensureAdminOrOwner(userId: string, companyId: string) {
    const membership = await prisma.companyMember.findFirst({
      where: {
        userId,
        companyId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!membership) {
      throw new AppError('You do not have permission to manage this company', 403, 'FORBIDDEN');
    }
  }

  private sanitizeFileName(name: string): string {
    return name.trim().replace(/[^a-zA-Z0-9.\-_]+/g, '-');
  }

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

    // Map profile with optional fields respecting exactOptionalPropertyTypes
    const profile: CompanyProfile | null = company.profile
      ? {
          ...(company.profile.stats != null ? { stats: company.profile.stats as any } : {}),
          ...(company.profile.vision != null ? { vision: company.profile.vision } : {}),
          ...(company.profile.mission != null ? { mission: company.profile.mission } : {}),
          ...(company.profile.coreValues != null ? { coreValues: company.profile.coreValues } : {}),
          ...(company.profile.leadershipPhilosophy != null
            ? { leadershipPhilosophy: company.profile.leadershipPhilosophy as any }
            : {}),
          ...(company.profile.products != null ? { products: company.profile.products as any } : {}),
          ...(company.profile.recruitmentPrinciples != null
            ? { recruitmentPrinciples: company.profile.recruitmentPrinciples as any }
            : {}),
          ...(company.profile.benefits != null ? { benefits: company.profile.benefits as any } : {}),
          ...(company.profile.hrJourney != null ? { hrJourney: company.profile.hrJourney as any } : {}),
          ...(company.profile.careerPath != null ? { careerPath: company.profile.careerPath as any } : {}),
          ...(company.profile.salaryAndBonus != null
            ? { salaryAndBonus: company.profile.salaryAndBonus as any }
            : {}),
          ...(company.profile.training != null ? { training: company.profile.training as any } : {}),
          ...(company.profile.leaders != null ? { leaders: company.profile.leaders as any } : {}),
          ...(company.profile.story != null ? { story: company.profile.story as any } : {}),
          ...(company.profile.culture != null ? { culture: company.profile.culture as any } : {}),
          ...(company.profile.awards != null ? { awards: company.profile.awards as any } : {}),
          createdAt: company.profile.createdAt,
          updatedAt: company.profile.updatedAt,
        }
      : null;

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

  // =========================
  // Verification contacts CSV
  // =========================

  async uploadVerificationContactsCsv(
    userId: string,
    companyId: string,
    input: UploadVerificationContactsCsvInput,
  ) {
    await this.ensureAdminOrOwner(userId, companyId);

    const { fileName, fileType, fileData, listName } = input;

    const ALLOWED_CSV_MIME_TYPES = new Set([
      'text/csv',
      'application/vnd.ms-excel',
      'text/plain',
    ]);
    const MAX_CSV_SIZE = 2 * 1024 * 1024; // 2MB

    if (!ALLOWED_CSV_MIME_TYPES.has(fileType)) {
      throw new AppError(
        'Chỉ chấp nhận tệp CSV (text/csv)',
        400,
        'INVALID_CSV_TYPE',
      );
    }

    const buffer = Buffer.from(fileData, 'base64');
    if (!buffer.length) {
      throw new AppError('Tệp CSV không được rỗng', 400, 'EMPTY_FILE');
    }
    if (buffer.length > MAX_CSV_SIZE) {
      throw new AppError(
        'Kích thước tệp CSV vượt quá giới hạn 2MB',
        400,
        'FILE_TOO_LARGE',
      );
    }

    const now = new Date();
    const safeBaseName =
      listName?.trim() ||
      this.sanitizeFileName(fileName.replace(/\.csv$/i, '') || 'ds-nhan-vien');

    const key = `companies/${companyId}/verification-lists/${crypto.randomUUID()}.csv`;

    // Upload raw CSV to S3
    try {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: getS3BucketName(),
          Key: key,
          Body: buffer,
          ContentType: fileType,
          ContentLength: buffer.length,
        }),
      );
    } catch (error) {
      console.error('Failed to upload verification CSV to S3', error);
      throw new AppError(
        'Không thể tải tệp CSV lên, vui lòng thử lại.',
        500,
        'UPLOAD_FAILED',
      );
    }

    // Parse CSV (simple parser: email,name)
    const text = buffer.toString('utf8');
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (!lines.length) {
      throw new AppError('Tệp CSV không chứa dữ liệu', 400, 'CSV_NO_ROWS');
    }

    const headerLine = lines[0]!;
    const header = headerLine
      .split(',')
      .map((h) => h.trim().toLowerCase());

    const emailIndex = header.indexOf('email');
    const nameIndex = header.indexOf('name');

    if (emailIndex === -1) {
      throw new AppError(
        'Dòng đầu tiên của CSV phải chứa cột "email" (và tùy chọn "name")',
        400,
        'CSV_INVALID_HEADER',
      );
    }

    const contacts: { email: string; name?: string }[] = [];
    for (let i = 1; i < lines.length; i++) {
      const rawLine = lines[i] ?? '';
      const row = rawLine.split(',');
      const rawEmail = (row[emailIndex] ?? '').trim();
      if (!rawEmail) continue;
      const email = rawEmail.toLowerCase();
      const nameValue =
        nameIndex !== -1 ? (row[nameIndex] ?? '').trim() || undefined : undefined;

      const contactObj: { email: string; name?: string } = { email };
      if (nameValue !== undefined) {
        contactObj.name = nameValue;
      }

      contacts.push(contactObj);
    }

    if (!contacts.length) {
      throw new AppError(
        'Không tìm thấy email hợp lệ trong tệp CSV',
        400,
        'CSV_NO_VALID_EMAILS',
      );
    }

    const fileUrl = buildS3ObjectUrl(key);

    const result = await prisma.$transaction(async (tx) => {
      const list = await tx.companyVerificationList.create({
        data: {
          companyId,
          name: safeBaseName,
          fileKey: key,
        },
      });

      let createdContacts = 0;

      for (const contact of contacts) {
        const contactRecord = await tx.companyVerificationContact.upsert({
          where: {
            companyId_email: {
              companyId,
              email: contact.email,
            },
          },
          create: {
            companyId,
            email: contact.email,
            name: contact.name ?? null,
            token: crypto.randomBytes(32).toString('hex'),
          },
          update: {
            ...(contact.name ? { name: contact.name } : {}),
          },
        });

        await tx.companyVerificationListItem.upsert({
          where: {
            listId_contactId: {
              listId: list.id,
              contactId: contactRecord.id,
            },
          },
          create: {
            listId: list.id,
            contactId: contactRecord.id,
          },
          update: {},
        });

        createdContacts++;
      }

      return {
        list: {
          id: list.id,
          name: list.name,
          fileKey: list.fileKey,
          fileUrl,
          createdAt: list.createdAt,
        },
        contactsCount: createdContacts,
        uploadedAt: now,
      };
    });

    return result;
  }

  async getVerificationContactLists(companyId: string, userId: string) {
    await this.ensureAdminOrOwner(userId, companyId);

    const lists = await prisma.companyVerificationList.findMany({
      where: { companyId },
      include: {
        items: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      lists: lists.map((l: any) => ({
        id: l.id,
        name: l.name,
        fileKey: l.fileKey,
        fileUrl: buildS3ObjectUrl(l.fileKey),
        createdAt: l.createdAt,
        contactsCount: l.items.length,
      })),
    };
  }

  // =========================
  // Company statements - send & manage
  // =========================

  async sendCompanyStatements(
    companyId: string,
    userId: string,
    input: SendCompanyStatementsInput,
  ) {
    await this.ensureAdminOrOwner(userId, companyId);

    const { listId, statements } = input;

    const [company, list] = await Promise.all([
      prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true, name: true, slug: true },
      }),
      prisma.companyVerificationList.findFirst({
        where: { id: listId, companyId },
        include: {
          items: {
            include: {
              contact: true,
            },
          },
        },
      }),
    ]);

    if (!company) {
      throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
    }

    if (!list) {
      throw new AppError(
        'Danh sách email xác thực không tồn tại',
        404,
        'VERIFICATION_LIST_NOT_FOUND',
      );
    }

    const contacts = list.items.map((i: any) => i.contact);
    if (!contacts.length) {
      throw new AppError(
        'Danh sách email không có nhân viên nào. Vui lòng kiểm tra lại tệp CSV.',
        400,
        'VERIFICATION_LIST_EMPTY',
      );
    }

    const now = new Date();

    const createdStatements = await prisma.$transaction(async (tx) => {
      // 1. Tạo các statement mới
      const stmts = await Promise.all(
        statements.map((s) =>
          tx.companyStatement.create({
            data: {
              companyId,
              title: s.title,
              description: s.description ?? null,
              isPublic: s.isPublic ?? true,
              status: 'ACTIVE',
              sentAt: now,
              expiresAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), // +3 ngày
            },
          }),
        ),
      );

      // 2. Tạo recipient cho từng statement-contact
      for (const stmt of stmts) {
        for (const item of list.items) {
          await tx.companyStatementRecipient.create({
            data: {
              statementId: stmt.id,
              contactId: item.contactId,
              sentAt: now,
            },
          });
        }
      }

      return stmts;
    });

    // 3. Gửi email cho từng contact (ngoài transaction)
    const verifyBaseUrl = `${config.FRONTEND_ORIGIN}/verify/company/${company.slug}`;

    for (const contact of contacts as any[]) {
      const verifyUrl = `${verifyBaseUrl}?token=${encodeURIComponent(
        contact.token,
      )}`;

      try {
        await emailService.sendCompanyStatementsVerificationEmail(contact.email, {
          companyName: company.name,
          contactName: contact.name,
          verifyUrl,
          statements: createdStatements.map((s: any) => ({
            title: s.title,
            description: s.description ?? undefined,
            expiresAt: s.expiresAt ?? undefined,
          })),
        });
      } catch (error) {
        console.error(
          'Failed to send statement verification email',
          contact.email,
          error,
        );
        // Không throw để tránh fail cả batch; log là đủ
      }
    }

    return {
      statements: createdStatements.map((s: any) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        isPublic: s.isPublic,
        sentAt: s.sentAt,
        expiresAt: s.expiresAt,
      })),
      recipientsCount: contacts.length,
      listId: list.id,
    };
  }

  private async getStatementsWithStats(companyId: string, forPublic = false) {
    const now = new Date();

    const statements = await prisma.companyStatement.findMany({
      where: {
        companyId,
        ...(forPublic ? { isPublic: true } : {}),
      },
      include: {
        recipients: true,
      },
      orderBy: [
        { order: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    return statements.map((s: any) => {
      const totalRecipients = s.recipients.length;
      const yesCount = s.recipients.filter(
        (r: any) => r.answer === CompanyStatementAnswer.YES,
      ).length;
      const respondedCount = s.recipients.filter(
        (r: any) => r.answer !== null,
      ).length;
      const percentYes =
        totalRecipients > 0 ? Math.round((yesCount / totalRecipients) * 100) : 0;
      const isExpired = !!s.expiresAt && s.expiresAt < now;

      return {
        id: s.id,
        title: s.title,
        description: s.description,
        isPublic: s.isPublic,
        status: s.status,
        sentAt: s.sentAt,
        expiresAt: s.expiresAt,
        totalRecipients,
        yesCount,
        respondedCount,
        percentYes,
        isExpired,
      };
    });
  }

  async getCompanyStatementsForManage(companyId: string, userId: string) {
    await this.ensureAdminOrOwner(userId, companyId);
    const items = await this.getStatementsWithStats(companyId, false);
    return { statements: items };
  }

  async updateCompanyStatement(
    companyId: string,
    userId: string,
    statementId: string,
    data: { isPublic?: boolean },
  ) {
    await this.ensureAdminOrOwner(userId, companyId);

    const stmt = await prisma.companyStatement.findUnique({
      where: { id: statementId },
      select: { id: true, companyId: true },
    });

    if (!stmt || stmt.companyId !== companyId) {
      throw new AppError('Statement not found', 404, 'STATEMENT_NOT_FOUND');
    }

    const updated = await prisma.companyStatement.update({
      where: { id: statementId },
      data: {
        ...(typeof data.isPublic === 'boolean' ? { isPublic: data.isPublic } : {}),
      },
    });

    return {
      id: updated.id,
      isPublic: updated.isPublic,
    };
  }

  // =========================
  // Public verification flows
  // =========================

  async getStatementsForVerificationView(slug: string, token: string) {
    const company = await prisma.company.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true },
    });

    if (!company) {
      throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
    }

    if (!token) {
      throw new AppError('Thiếu token xác thực', 400, 'MISSING_TOKEN');
    }

    const contact = await prisma.companyVerificationContact.findFirst({
      where: {
        token,
        companyId: company.id,
      },
    });

    if (!contact) {
      throw new AppError(
        'Liên kết xác thực không hợp lệ hoặc đã hết hạn',
        404,
        'CONTACT_NOT_FOUND',
      );
    }

    const now = new Date();

    const recipients = await prisma.companyStatementRecipient.findMany({
      where: {
        contactId: contact.id,
        answer: null,
        statement: {
          companyId: company.id,
          expiresAt: {
            gt: now,
          },
        },
      },
      include: {
        statement: true,
      },
      orderBy: {
        sentAt: 'asc',
      },
    });

    const statements = recipients.map((r) => ({
      id: r.statement.id,
      title: r.statement.title,
      description: r.statement.description ?? undefined,
      expiresAt: r.statement.expiresAt ?? undefined,
    }));

    return {
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
      },
      contact: {
        email: contact.email,
        name: contact.name ?? undefined,
      },
      statements,
    };
  }

  async submitStatementsVerification(slug: string, body: any) {
    const company = await prisma.company.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!company) {
      throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
    }

    const token = typeof body?.token === 'string' ? body.token : '';
    const answers = Array.isArray(body?.answers) ? body.answers : [];

    if (!token) {
      throw new AppError('Thiếu token xác thực', 400, 'MISSING_TOKEN');
    }

    if (!answers.length) {
      throw new AppError(
        'Không có dữ liệu phản hồi nào được gửi lên',
        400,
        'NO_ANSWERS',
      );
    }

    const contact = await prisma.companyVerificationContact.findFirst({
      where: {
        token,
        companyId: company.id,
      },
    });

    if (!contact) {
      throw new AppError(
        'Liên kết xác thực không hợp lệ hoặc đã hết hạn',
        404,
        'CONTACT_NOT_FOUND',
      );
    }

    const now = new Date();

    let updatedCount = 0;

    for (const item of answers as any[]) {
      if (
        !item ||
        typeof item.statementId !== 'string' ||
        (item.answer !== 'YES' && item.answer !== 'NO')
      ) {
        continue;
      }

      const recipient = await prisma.companyStatementRecipient.findUnique({
        where: {
          statementId_contactId: {
            statementId: item.statementId,
            contactId: contact.id,
          },
        },
        include: {
          statement: true,
        },
      });

      if (!recipient) continue;
      if (recipient.answer !== null) continue;
      if (recipient.statement.companyId !== company.id) continue;
      if (recipient.statement.expiresAt && recipient.statement.expiresAt < now)
        continue;

      await prisma.companyStatementRecipient.update({
        where: {
          statementId_contactId: {
            statementId: item.statementId,
            contactId: contact.id,
          },
        },
        data: {
          answer: item.answer as CompanyStatementAnswer,
          verifiedAt: now,
        },
      });

      updatedCount++;
    }

    return {
      updated: updatedCount,
    };
  }

  async reorderCompanyStatements(
    companyId: string,
    userId: string,
    orders: { id: string; order: number }[],
  ) {
    await this.ensureAdminOrOwner(userId, companyId);

    const transaction = orders.map((item) =>
      prisma.companyStatement.update({
        where: { id: item.id, companyId },
        data: { order: item.order },
      }),
    );

    await prisma.$transaction(transaction);

    return { success: true };
  }

  async getPublicCompanyStatements(slug: string) {
    const company = await prisma.company.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!company) {
      throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
    }

    const statements = await this.getStatementsWithStats(company.id, true);

    return {
      statements,
    };
  }
}
