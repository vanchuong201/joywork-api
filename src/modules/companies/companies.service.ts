import { prisma } from '@/shared/database/prisma';
import { AppError } from '@/shared/errors/errorHandler';
import {
  CreateCompanyInput,
  UpdateCompanyInput,
  GetCompanyInput,
  SearchCompaniesInput,
  AddCompanyMemberInput,
  UpdateCompanyMemberInput,
} from './companies.schema';

export interface Company {
  id: string;
  name: string;
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
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanyWithMembers {
  id: string;
  name: string;
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
    const company = await prisma.company.create({
      data: {
        ...data,
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

    return {
      id: company.id,
      name: company.name,
      slug: company.slug,
      tagline: company.tagline,
      description: company.description,
      logoUrl: company.logoUrl,
      coverUrl: company.coverUrl,
      website: company.website,
      location: company.location,
      industry: company.industry,
      size: company.size,
      foundedYear: company.foundedYear,
      isVerified: company.isVerified,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
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
    if (data.slug) {
      const existingCompany = await prisma.company.findFirst({
        where: {
          slug: data.slug,
          id: { not: companyId },
        },
      });

      if (existingCompany) {
        throw new AppError('Company with this slug already exists', 409, 'SLUG_EXISTS');
      }
    }

    // Update company
    const company = await prisma.company.update({
      where: { id: companyId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });

    return {
      id: company.id,
      name: company.name,
      slug: company.slug,
      tagline: company.tagline,
      description: company.description,
      logoUrl: company.logoUrl,
      coverUrl: company.coverUrl,
      website: company.website,
      location: company.location,
      industry: company.industry,
      size: company.size,
      foundedYear: company.foundedYear,
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
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!company) {
      return null;
    }

    return {
      id: company.id,
      name: company.name,
      slug: company.slug,
      tagline: company.tagline,
      description: company.description,
      logoUrl: company.logoUrl,
      coverUrl: company.coverUrl,
      website: company.website,
      location: company.location,
      industry: company.industry,
      size: company.size,
      foundedYear: company.foundedYear,
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
          name: member.user.name,
        },
      })),
    };
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
        slug: company.slug,
        tagline: company.tagline,
        description: company.description,
        logoUrl: company.logoUrl,
        coverUrl: company.coverUrl,
        website: company.website,
        location: company.location,
        industry: company.industry,
        size: company.size,
        foundedYear: company.foundedYear,
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
  async getUserCompanies(userId: string): Promise<Company[]> {
    const memberships = await prisma.companyMember.findMany({
      where: { userId },
      include: {
        company: true,
      },
      orderBy: { joinedAt: 'desc' },
    });

    return memberships.map(membership => ({
      id: membership.company.id,
      name: membership.company.name,
      slug: membership.company.slug,
      tagline: membership.company.tagline,
      description: membership.company.description,
      logoUrl: membership.company.logoUrl,
      coverUrl: membership.company.coverUrl,
      website: membership.company.website,
      location: membership.company.location,
      industry: membership.company.industry,
      size: membership.company.size,
      foundedYear: membership.company.foundedYear,
      isVerified: membership.company.isVerified,
      createdAt: membership.company.createdAt,
      updatedAt: membership.company.updatedAt,
    }));
  }

  // Add company member
  async addCompanyMember(companyId: string, ownerId: string, data: AddCompanyMemberInput): Promise<void> {
    // Check if user is owner/admin of company
    const membership = await prisma.companyMember.findFirst({
      where: {
        userId: ownerId,
        companyId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!membership) {
      throw new AppError('You do not have permission to add members', 403, 'FORBIDDEN');
    }

    // Check if user is already a member
    const existingMembership = await prisma.companyMember.findUnique({
      where: {
        userId_companyId: {
          userId: data.userId,
          companyId,
        },
      },
    });

    if (existingMembership) {
      throw new AppError('User is already a member of this company', 409, 'MEMBER_EXISTS');
    }

    // Add member
    await prisma.companyMember.create({
      data: {
        userId: data.userId,
        companyId,
        role: data.role,
      },
    });
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

    // Remove member
    await prisma.companyMember.delete({
      where: { id: memberId },
    });
  }
}
