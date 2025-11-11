import { prisma } from '@/shared/database/prisma';
import { AppError } from '@/shared/errors/errorHandler';
import {
  CreateJobInput,
  UpdateJobInput,
  GetJobInput,
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
    const job = await prisma.job.create({
      data: {
        ...data,
        companyId,
        applicationDeadline: data.applicationDeadline ? new Date(data.applicationDeadline) : null,
      },
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

    return {
      id: job.id,
      companyId: job.companyId,
      title: job.title,
      description: job.description,
      requirements: job.requirements,
      responsibilities: job.responsibilities,
      benefits: job.benefits,
      location: job.location,
      remote: job.remote,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      currency: job.currency,
      employmentType: job.employmentType,
      experienceLevel: job.experienceLevel,
      skills: job.skills,
      tags: job.tags,
      applicationDeadline: job.applicationDeadline,
      isActive: job.isActive,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      company: job.company,
      _count: job._count,
    };
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
    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: {
        ...data,
        applicationDeadline: data.applicationDeadline ? new Date(data.applicationDeadline) : undefined,
        updatedAt: new Date(),
      },
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

    return {
      id: updatedJob.id,
      companyId: updatedJob.companyId,
      title: updatedJob.title,
      description: updatedJob.description,
      requirements: updatedJob.requirements,
      responsibilities: updatedJob.responsibilities,
      benefits: updatedJob.benefits,
      location: updatedJob.location,
      remote: updatedJob.remote,
      salaryMin: updatedJob.salaryMin,
      salaryMax: updatedJob.salaryMax,
      currency: updatedJob.currency,
      employmentType: updatedJob.employmentType,
      experienceLevel: updatedJob.experienceLevel,
      skills: updatedJob.skills,
      tags: updatedJob.tags,
      applicationDeadline: updatedJob.applicationDeadline,
      isActive: updatedJob.isActive,
      createdAt: updatedJob.createdAt,
      updatedAt: updatedJob.updatedAt,
      company: updatedJob.company,
      _count: updatedJob._count,
    };
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

    return {
      id: job.id,
      companyId: job.companyId,
      title: job.title,
      description: job.description,
      requirements: job.requirements,
      responsibilities: job.responsibilities,
      benefits: job.benefits,
      location: job.location,
      remote: job.remote,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      currency: job.currency,
      employmentType: job.employmentType,
      experienceLevel: job.experienceLevel,
      skills: job.skills,
      tags: job.tags,
      applicationDeadline: job.applicationDeadline,
      isActive: job.isActive,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      company: job.company,
      _count: job._count,
      hasApplied,
    };
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
    const { q, location, remote, employmentType, experienceLevel, salaryMin, salaryMax, skills, companyId, page, limit } = data;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { isActive: true };

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

      jobsWithApplications.push({
        id: job.id,
        companyId: job.companyId,
        title: job.title,
        description: job.description,
        requirements: job.requirements,
        responsibilities: job.responsibilities,
        benefits: job.benefits,
        location: job.location,
        remote: job.remote,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        currency: job.currency,
        employmentType: job.employmentType,
        experienceLevel: job.experienceLevel,
        skills: job.skills,
        tags: job.tags,
        applicationDeadline: job.applicationDeadline,
        isActive: job.isActive,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        company: job.company,
        _count: job._count,
        hasApplied,
      });
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
        coverLetter: data.coverLetter,
        resumeUrl: data.resumeUrl,
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
      applications: applications.map(app => ({
        id: app.id,
        jobId: app.jobId,
        userId: app.userId,
        status: app.status,
        coverLetter: app.coverLetter,
        resumeUrl: app.resumeUrl,
        notes: app.notes,
        appliedAt: app.appliedAt,
        updatedAt: app.updatedAt,
        job: {
          id: app.job.id,
          title: app.job.title,
          company: app.job.company,
        },
        user: {
          id: app.user.id,
          name: app.user.name,
          email: app.user.email,
          profile: app.user.profile,
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
        notes: data.notes,
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
      applications: applications.map(app => ({
        id: app.id,
        jobId: app.jobId,
        userId: app.userId,
        status: app.status,
        coverLetter: app.coverLetter,
        resumeUrl: app.resumeUrl,
        notes: app.notes,
        appliedAt: app.appliedAt,
        updatedAt: app.updatedAt,
        job: {
          id: app.job.id,
          title: app.job.title,
          company: app.job.company,
        },
        user: {
          id: app.user.id,
          name: app.user.name,
          email: app.user.email,
          profile: app.user.profile,
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
          location: fav.job.location,
          remote: fav.job.remote,
          employmentType: fav.job.employmentType,
          experienceLevel: fav.job.experienceLevel,
          salaryMin: fav.job.salaryMin,
          salaryMax: fav.job.salaryMax,
          currency: fav.job.currency,
          company: fav.job.company,
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
