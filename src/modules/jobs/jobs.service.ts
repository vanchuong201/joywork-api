import { prisma } from '@/shared/database/prisma';
import { AppError } from '@/shared/errors/errorHandler';
import {
  CreateJobInput,
  UpdateJobInput,
  SearchJobsInput,
  ApplyJobInput,
  GetApplicationsInput,
  UpdateApplicationStatusInput,
  GetMyApplicationsInput,
  GetMyFavoritesInput,
} from './jobs.schema';

export interface Job {
  id: string;
  companyId: string;
  title: string;
  description: string;
  requirements?: string;
  responsibilities?: string;
  benefits?: string;
  location?: string;
  remote: boolean;
  salaryMin?: number;
  salaryMax?: number;
  currency: string;
  employmentType: string;
  experienceLevel: string;
  skills: string[];
  tags: string[];
  applicationDeadline?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  company: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string;
  };
  _count: {
    applications: number;
  };
}

export interface JobWithApplication extends Job {
  hasApplied: boolean;
}

export interface Application {
  id: string;
  jobId: string;
  userId: string;
  status: string;
  coverLetter?: string;
  resumeUrl?: string;
  notes?: string;
  appliedAt: Date;
  updatedAt: Date;
  job: {
    id: string;
    title: string;
    company: {
      id: string;
      name: string;
      slug: string;
      logoUrl?: string;
    };
  };
  user: {
    id: string;
    name?: string;
    email: string;
    profile?: {
      id: string;
      headline?: string;
      avatar?: string;
      cvUrl?: string;
    };
  };
}

export interface JobFavorite {
  id: string;
  jobId: string;
  createdAt: Date;
  job: {
    id: string;
    title: string;
    location?: string | null;
    remote: boolean;
    employmentType: string;
    experienceLevel: string;
    salaryMin?: number | null;
    salaryMax?: number | null;
    currency: string;
    company: {
      id: string;
      name: string;
      slug: string;
      logoUrl?: string | null;
    };
  };
}

export class JobsService {
  // Create job
  async createJob(companyId: string, userId: string, data: CreateJobInput): Promise<Job> {
    // Check if user is member of company
    const membership = await prisma.companyMember.findFirst({
      where: {
        userId,
        companyId,
        role: { in: ['OWNER', 'ADMIN', 'MEMBER'] },
      },
    });

    if (!membership) {
      throw new AppError('You do not have permission to create jobs for this company', 403, 'FORBIDDEN');
    }

    // Create job
    const jobData: any = {
        companyId,
      title: data.title,
      description: data.description,
      remote: data.remote,
      currency: data.currency,
      employmentType: data.employmentType,
      experienceLevel: data.experienceLevel,
      skills: data.skills,
      isActive: data.isActive ?? true,
        applicationDeadline: data.applicationDeadline ? new Date(data.applicationDeadline) : null,
      requirements: data.requirements ?? null,
      responsibilities: data.responsibilities ?? null,
      benefits: data.benefits ?? null,
      location: data.location ?? null,
      salaryMin: data.salaryMin ?? null,
      salaryMax: data.salaryMax ?? null,
      tags: data.tags ?? [],
    };
    
    const job = await prisma.job.create({
      data: jobData,
      include: {
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
          },
        },
        _count: {
          select: {
            applications: true,
          },
        },
      },
    });

    const result: any = {
      id: job.id,
      companyId: job.companyId,
      title: job.title,
      description: job.description,
      remote: job.remote,
      currency: job.currency,
      employmentType: job.employmentType,
      experienceLevel: job.experienceLevel,
      skills: job.skills,
      tags: job.tags,
      isActive: job.isActive,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      company: {
        id: job.company.id,
        name: job.company.name,
        slug: job.company.slug,
      },
      _count: job._count,
    };
    
    if (job.requirements) result.requirements = job.requirements;
    if (job.responsibilities) result.responsibilities = job.responsibilities;
    if (job.benefits) result.benefits = job.benefits;
    if (job.location) result.location = job.location;
    if (job.salaryMin !== null) result.salaryMin = job.salaryMin;
    if (job.salaryMax !== null) result.salaryMax = job.salaryMax;
    if (job.applicationDeadline) result.applicationDeadline = job.applicationDeadline;
    if (job.company.logoUrl) result.company.logoUrl = job.company.logoUrl;
    
    return result;
  }

  // Update job
  async updateJob(jobId: string, userId: string, data: UpdateJobInput): Promise<Job> {
    // Get job with company info
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        company: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
      },
    });

    if (!job) {
      throw new AppError('Job not found', 404, 'JOB_NOT_FOUND');
    }

    // Check if user is member of company
    const membership = job.company.members[0];
    if (!membership || !['OWNER', 'ADMIN', 'MEMBER'].includes(membership.role)) {
      throw new AppError('You do not have permission to update this job', 403, 'FORBIDDEN');
    }

    // Update job
    const updateData: any = {
      updatedAt: new Date(),
    };
    
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.requirements !== undefined) updateData.requirements = data.requirements ?? null;
    if (data.responsibilities !== undefined) updateData.responsibilities = data.responsibilities ?? null;
    if (data.benefits !== undefined) updateData.benefits = data.benefits ?? null;
    if (data.location !== undefined) updateData.location = data.location ?? null;
    if (data.remote !== undefined) updateData.remote = data.remote;
    if (data.salaryMin !== undefined) updateData.salaryMin = data.salaryMin ?? null;
    if (data.salaryMax !== undefined) updateData.salaryMax = data.salaryMax ?? null;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.employmentType !== undefined) updateData.employmentType = data.employmentType;
    if (data.experienceLevel !== undefined) updateData.experienceLevel = data.experienceLevel;
    if (data.skills !== undefined) updateData.skills = data.skills;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.applicationDeadline !== undefined) updateData.applicationDeadline = data.applicationDeadline ? new Date(data.applicationDeadline) : null;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    
    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: updateData,
      include: {
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
          },
        },
        _count: {
          select: {
            applications: true,
          },
        },
      },
    });

    const result: any = {
      id: updatedJob.id,
      companyId: updatedJob.companyId,
      title: updatedJob.title,
      description: updatedJob.description,
      remote: updatedJob.remote,
      currency: updatedJob.currency,
      employmentType: updatedJob.employmentType,
      experienceLevel: updatedJob.experienceLevel,
      skills: updatedJob.skills,
      tags: updatedJob.tags,
      isActive: updatedJob.isActive,
      createdAt: updatedJob.createdAt,
      updatedAt: updatedJob.updatedAt,
      company: {
        id: updatedJob.company.id,
        name: updatedJob.company.name,
        slug: updatedJob.company.slug,
      },
      _count: updatedJob._count,
    };
    
    if (updatedJob.requirements) result.requirements = updatedJob.requirements;
    if (updatedJob.responsibilities) result.responsibilities = updatedJob.responsibilities;
    if (updatedJob.benefits) result.benefits = updatedJob.benefits;
    if (updatedJob.location) result.location = updatedJob.location;
    if (updatedJob.salaryMin !== null) result.salaryMin = updatedJob.salaryMin;
    if (updatedJob.salaryMax !== null) result.salaryMax = updatedJob.salaryMax;
    if (updatedJob.applicationDeadline) result.applicationDeadline = updatedJob.applicationDeadline;
    if (updatedJob.company.logoUrl) result.company.logoUrl = updatedJob.company.logoUrl;
    
    return result;
  }

  // Get job by ID
  async getJobById(jobId: string, userId?: string): Promise<JobWithApplication | null> {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
          },
        },
        _count: {
          select: {
            applications: true,
          },
        },
      },
    });

    if (!job) {
      return null;
    }

    // Check if user has applied for this job
    let hasApplied = false;
    if (userId) {
      const application = await prisma.application.findUnique({
        where: {
          userId_jobId: {
            userId,
            jobId,
          },
        },
      });
      hasApplied = !!application;
    }

    const result: any = {
      id: job.id,
      companyId: job.companyId,
      title: job.title,
      description: job.description,
      remote: job.remote,
      currency: job.currency,
      employmentType: job.employmentType,
      experienceLevel: job.experienceLevel,
      skills: job.skills,
      tags: job.tags,
      isActive: job.isActive,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      company: {
        id: job.company.id,
        name: job.company.name,
        slug: job.company.slug,
      },
      _count: job._count,
      hasApplied,
    };
    
    if (job.requirements) result.requirements = job.requirements;
    if (job.responsibilities) result.responsibilities = job.responsibilities;
    if (job.benefits) result.benefits = job.benefits;
    if (job.location) result.location = job.location;
    if (job.salaryMin !== null) result.salaryMin = job.salaryMin;
    if (job.salaryMax !== null) result.salaryMax = job.salaryMax;
    if (job.applicationDeadline) result.applicationDeadline = job.applicationDeadline;
    if (job.company.logoUrl) result.company.logoUrl = job.company.logoUrl;
    
    return result;
  }

  // Search jobs
  async searchJobs(data: SearchJobsInput, userId?: string): Promise<{
    jobs: JobWithApplication[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const { q, location, remote, employmentType, experienceLevel, salaryMin, salaryMax, skills, companyId, isActive, page, limit } = data;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    if (isActive !== undefined) {
      where.isActive = isActive;
    } else {
      // Default: only active jobs for public search.
      // For company-specific management (companyId provided), show all unless explicitly filtered.
      if (!companyId) {
        where.isActive = true;
      }
    }

    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { requirements: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (location) {
      where.location = { contains: location, mode: 'insensitive' };
    }

    if (remote !== undefined) {
      where.remote = remote;
    }

    if (employmentType) {
      where.employmentType = employmentType;
    }

    if (experienceLevel) {
      where.experienceLevel = experienceLevel;
    }

    if (salaryMin !== undefined || salaryMax !== undefined) {
      where.AND = [];
      if (salaryMin !== undefined) {
        where.AND.push({ salaryMin: { gte: salaryMin } });
      }
      if (salaryMax !== undefined) {
        where.AND.push({ salaryMax: { lte: salaryMax } });
      }
    }

    if (skills) {
      const skillArray = skills.split(',').map(s => s.trim());
      where.skills = { hasSome: skillArray };
    }

    if (companyId) {
      where.companyId = companyId;
    }

    // Get jobs with pagination
    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
            },
          },
          _count: {
            select: {
              applications: true,
            },
          },
        },
      }),
      prisma.job.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // Check if user has applied for each job
    const jobsWithApplications: JobWithApplication[] = [];
    for (const job of jobs) {
      let hasApplied = false;
      if (userId) {
        const application = await prisma.application.findUnique({
          where: {
            userId_jobId: {
              userId,
              jobId: job.id,
            },
          },
        });
        hasApplied = !!application;
      }

      const jobResult: any = {
        id: job.id,
        companyId: job.companyId,
        title: job.title,
        description: job.description,
        remote: job.remote,
        currency: job.currency,
        employmentType: job.employmentType,
        experienceLevel: job.experienceLevel,
        skills: job.skills,
        tags: job.tags,
        isActive: job.isActive,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        company: {
          id: job.company.id,
          name: job.company.name,
          slug: job.company.slug,
        },
        _count: job._count,
        hasApplied,
      };
      
      if (job.requirements) jobResult.requirements = job.requirements;
      if (job.responsibilities) jobResult.responsibilities = job.responsibilities;
      if (job.benefits) jobResult.benefits = job.benefits;
      if (job.location) jobResult.location = job.location;
      if (job.salaryMin !== null) jobResult.salaryMin = job.salaryMin;
      if (job.salaryMax !== null) jobResult.salaryMax = job.salaryMax;
      if (job.applicationDeadline) jobResult.applicationDeadline = job.applicationDeadline;
      if (job.company.logoUrl) jobResult.company.logoUrl = job.company.logoUrl;
      
      jobsWithApplications.push(jobResult);
    }

    return {
      jobs: jobsWithApplications,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  // Apply for job
  async applyForJob(userId: string, data: ApplyJobInput): Promise<void> {
    // Check if job exists and is active
    const job = await prisma.job.findUnique({
      where: { id: data.jobId },
    });

    if (!job) {
      throw new AppError('Job not found', 404, 'JOB_NOT_FOUND');
    }

    if (!job.isActive) {
      throw new AppError('Job is no longer active', 400, 'JOB_INACTIVE');
    }

    // Check if application deadline has passed
    if (job.applicationDeadline && job.applicationDeadline < new Date()) {
      throw new AppError('Application deadline has passed', 400, 'DEADLINE_PASSED');
    }

    // Check if user has already applied
    const existingApplication = await prisma.application.findUnique({
      where: {
        userId_jobId: {
          userId,
          jobId: data.jobId,
        },
      },
    });

    if (existingApplication) {
      throw new AppError('You have already applied for this job', 409, 'ALREADY_APPLIED');
    }

    // Create application
    await prisma.application.create({
      data: {
        userId,
        jobId: data.jobId,
        coverLetter: data.coverLetter ?? null,
        resumeUrl: data.resumeUrl ?? null,
        status: 'PENDING',
      },
    });
  }

  // Get applications
  async getApplications(data: GetApplicationsInput, userId: string): Promise<{
    applications: Application[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const { jobId, companyId, status, page, limit } = data;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (jobId) {
      where.jobId = jobId;
    }

    if (companyId) {
      // Check if user is member of company
      const membership = await prisma.companyMember.findFirst({
        where: {
          userId,
          companyId,
          role: { in: ['OWNER', 'ADMIN', 'MEMBER'] },
        },
      });

      if (!membership) {
        throw new AppError('You do not have permission to view applications for this company', 403, 'FORBIDDEN');
      }

      where.job = {
        companyId,
      };
    }

    if (status) {
      where.status = status;
    }

    // Get applications with pagination
    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        skip,
        take: limit,
        orderBy: { appliedAt: 'desc' },
        include: {
          job: {
            include: {
              company: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  logoUrl: true,
                },
              },
            },
          },
          user: {
            include: {
              profile: {
                select: {
                  id: true,
                  headline: true,
                  avatar: true,
                  cvUrl: true,
                },
              },
            },
          },
        },
      }),
      prisma.application.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      applications: applications.map((app): any => ({
        id: app.id,
        jobId: app.jobId,
        userId: app.userId,
        status: app.status,
        ...(app.coverLetter ? { coverLetter: app.coverLetter } : {}),
        ...(app.resumeUrl ? { resumeUrl: app.resumeUrl } : {}),
        ...(app.notes ? { notes: app.notes } : {}),
        appliedAt: app.appliedAt,
        updatedAt: app.updatedAt,
        job: {
          id: app.job.id,
          title: app.job.title,
          company: {
            id: app.job.company.id,
            name: app.job.company.name,
            slug: app.job.company.slug,
            ...(app.job.company.logoUrl ? { logoUrl: app.job.company.logoUrl } : {}),
          },
        },
        user: {
          id: app.user.id,
          name: app.user.name ?? undefined,
          email: app.user.email,
          profile: app.user.profile ? {
            id: app.user.profile.id,
            headline: app.user.profile.headline ?? undefined,
            avatar: app.user.profile.avatar ?? undefined,
            cvUrl: app.user.profile.cvUrl ?? undefined,
          } : undefined,
        },
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  // Update application status
  async updateApplicationStatus(userId: string, data: UpdateApplicationStatusInput): Promise<void> {
    // Get application with job info
    const application = await prisma.application.findUnique({
      where: { id: data.applicationId },
      include: {
        job: {
          include: {
            company: {
              include: {
                members: {
                  where: { userId },
                },
              },
            },
          },
        },
      },
    });

    if (!application) {
      throw new AppError('Application not found', 404, 'APPLICATION_NOT_FOUND');
    }

    // Check if user is member of company
    const membership = application.job.company.members[0];
    if (!membership || !['OWNER', 'ADMIN', 'MEMBER'].includes(membership.role)) {
      throw new AppError('You do not have permission to update this application', 403, 'FORBIDDEN');
    }

    // Update application
    await prisma.application.update({
      where: { id: data.applicationId },
      data: {
        status: data.status,
        notes: data.notes ?? null,
        updatedAt: new Date(),
      },
    });
  }

  // Get my applications
  async getMyApplications(userId: string, data: GetMyApplicationsInput): Promise<{
    applications: Application[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const { status, page, limit } = data;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { userId };

    if (status) {
      where.status = status;
    }

    // Get applications with pagination
    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        skip,
        take: limit,
        orderBy: { appliedAt: 'desc' },
        include: {
          job: {
            include: {
              company: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  logoUrl: true,
                },
              },
            },
          },
          user: {
            include: {
              profile: {
                select: {
                  id: true,
                  headline: true,
                  avatar: true,
                  cvUrl: true,
                },
              },
            },
          },
        },
      }),
      prisma.application.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      applications: applications.map((app): any => ({
        id: app.id,
        jobId: app.jobId,
        userId: app.userId,
        status: app.status,
        ...(app.coverLetter ? { coverLetter: app.coverLetter } : {}),
        ...(app.resumeUrl ? { resumeUrl: app.resumeUrl } : {}),
        ...(app.notes ? { notes: app.notes } : {}),
        appliedAt: app.appliedAt,
        updatedAt: app.updatedAt,
        job: {
          id: app.job.id,
          title: app.job.title,
          company: {
            id: app.job.company.id,
            name: app.job.company.name,
            slug: app.job.company.slug,
            ...(app.job.company.logoUrl ? { logoUrl: app.job.company.logoUrl } : {}),
          },
        },
        user: {
          id: app.user.id,
          name: app.user.name ?? undefined,
          email: app.user.email,
          profile: app.user.profile ? {
            id: app.user.profile.id,
            headline: app.user.profile.headline ?? undefined,
            avatar: app.user.profile.avatar ?? undefined,
            cvUrl: app.user.profile.cvUrl ?? undefined,
          } : undefined,
        },
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  // Get my saved jobs
  async getMyFavorites(userId: string, data: GetMyFavoritesInput): Promise<{
    favorites: JobFavorite[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const { page, limit } = data;
    const skip = (page - 1) * limit;

    const [favorites, total] = await Promise.all([
      prisma.jobFavorite.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          job: {
            include: {
              company: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  logoUrl: true,
                },
              },
            },
          },
        },
      }),
      prisma.jobFavorite.count({ where: { userId } }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      favorites: favorites.map(fav => ({
        id: fav.id,
        jobId: fav.jobId,
        createdAt: fav.createdAt,
        job: {
          id: fav.job.id,
          title: fav.job.title,
          ...(fav.job.location ? { location: fav.job.location } : {}),
          remote: fav.job.remote,
          employmentType: fav.job.employmentType,
          experienceLevel: fav.job.experienceLevel,
          ...(fav.job.salaryMin !== null ? { salaryMin: fav.job.salaryMin } : {}),
          ...(fav.job.salaryMax !== null ? { salaryMax: fav.job.salaryMax } : {}),
          currency: fav.job.currency,
          company: {
            id: fav.job.company.id,
            name: fav.job.company.name,
            slug: fav.job.company.slug,
            ...(fav.job.company.logoUrl ? { logoUrl: fav.job.company.logoUrl } : {}),
          },
        },
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async addFavorite(jobId: string, userId: string): Promise<void> {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      throw new AppError('Job not found', 404, 'JOB_NOT_FOUND');
    }

    const existing = await prisma.jobFavorite.findUnique({
      where: {
        userId_jobId: { userId, jobId },
      },
    });

    if (existing) {
      return;
    }

    await prisma.jobFavorite.create({
      data: {
        userId,
        jobId,
      },
    });
  }

  async removeFavorite(jobId: string, userId: string): Promise<void> {
    const existing = await prisma.jobFavorite.findUnique({
      where: {
        userId_jobId: { userId, jobId },
      },
    });

    if (!existing) {
      throw new AppError('Job not saved', 404, 'JOB_NOT_SAVED');
    }

    await prisma.jobFavorite.delete({
      where: {
        userId_jobId: { userId, jobId },
      },
    });
  }

  // Delete job
  async deleteJob(jobId: string, userId: string): Promise<void> {
    // Get job with company info
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        company: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
      },
    });

    if (!job) {
      throw new AppError('Job not found', 404, 'JOB_NOT_FOUND');
    }

    // Check if user is member of company
    const membership = job.company.members[0];
    if (!membership || !['OWNER', 'ADMIN', 'MEMBER'].includes(membership.role)) {
      throw new AppError('You do not have permission to delete this job', 403, 'FORBIDDEN');
    }

    // Delete job
    await prisma.job.delete({
      where: { id: jobId },
    });
  }
}
