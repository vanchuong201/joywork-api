import { NotificationType, Prisma } from '@prisma/client';
import { config } from '@/config/env';
import { prisma } from '@/shared/database/prisma';
import { AppError } from '@/shared/errors/errorHandler';
import { getProvinceNameByCode, resolveProvinceCode } from '@/shared/provinces';
import { resolveLocationsWithWards } from '@/shared/wards';
import { getEsClient } from '@/shared/elasticsearch/client';
import { JOBS_INDEX } from '@/shared/elasticsearch/indices';
import { syncJobToEs, deleteJobFromEs } from '@/shared/elasticsearch/sync';
import { emailService } from '@/shared/services/email.service';
import { getVerifiedEmailForUser, getVerifiedEmailsForUsers } from '@/shared/services/email-helper.service';
import { notificationService } from '@/shared/services/notification.service';
import { slugifyVietnamese } from '@/shared/job-slug';
import { computeWorksOnSaturday, type WorkingTimeRange } from '@/shared/working-time';
import { generateAndStoreJobEmbedding, generateEmbedding } from '@/shared/services/embedding.service';
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
  slug?: string | null;
  description: string;
  requirements?: string;
  responsibilities?: string;
  benefits?: string;
  locations: string[];
  wardCodes: string[];
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

const APPLICATION_STATUS_LABEL: Record<string, string> = {
  RECEIVED: 'Tiếp nhận',
  SUITABLE: 'Phù hợp',
  INTERVIEW_SCHEDULED: 'Hẹn phỏng vấn',
  OFFER_SENT: 'Gửi đề nghị',
  HIRED: 'Nhận việc',
  NOT_SUITABLE: 'Chưa phù hợp',
};

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
    slug?: string | null;
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
    slug?: string | null;
    title: string;
    locations: string[];
    wardCodes: string[];
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
    const deadline = data.applicationDeadline ? new Date(data.applicationDeadline) : null;
    // Lưu deadline là 12:00 UTC của ngày đó để hiển thị đúng ngày ở mọi múi giờ (tránh 15/1 thành 16/1)
    if (deadline) {
      deadline.setUTCHours(12, 0, 0, 0);
    }

    const locInput: { locations?: string[]; location?: string | null; wardCodes?: string[] } = {};
    if (data.locations !== undefined) locInput.locations = data.locations;
    if (data.location !== undefined) locInput.location = data.location ?? null;
    if (data.wardCodes !== undefined) locInput.wardCodes = data.wardCodes;
    const resolved = resolveLocationsWithWards(null, locInput);

    const generatedSlug = slugifyVietnamese(data.title);

    const jobData: any = {
      companyId,
      title: data.title,
      slug: generatedSlug,
      locations: resolved.locations,
      wardCodes: resolved.wardCodes,
      remote: data.remote,
      currency: data.currency,
      employmentType: data.employmentType,
      experienceLevel: data.experienceLevel,
      tags: data.tags ?? [],
      isActive: data.isActive ?? true,
      applicationDeadline: deadline,
      salaryMin: data.salaryMin ?? null,
      salaryMax: data.salaryMax ?? null,
      // Header fields
      department: data.department ?? null,
      jobLevel: data.jobLevel ?? null,
      educationLevel: data.educationLevel ?? null,
      gender: data.gender ?? null,
      // Required JD fields
      generalInfo: data.generalInfo ?? '',
      mission: data.mission,
      tasks: data.tasks,
      knowledge: data.knowledge,
      skills: data.skills,
      attitude: data.attitude,
      // Optional JD fields
      kpis: data.kpis ?? null,
      authority: data.authority ?? null,
      relationships: data.relationships ?? null,
      careerPath: data.careerPath ?? null,
      benefitsIncome: data.benefitsIncome ?? null,
      benefitsPerks: data.benefitsPerks ?? null,
      contact: data.contact ?? null,
      // Working time
      workingTimeRanges: data.workingTimeRanges && data.workingTimeRanges.length > 0
        ? (data.workingTimeRanges as Prisma.InputJsonValue)
        : null,
      workingTimeNote: data.workingTimeNote?.trim() ? data.workingTimeNote.trim() : null,
      worksOnSaturday: computeWorksOnSaturday(data.workingTimeRanges as WorkingTimeRange[] | undefined),
    };
    
    const job = await prisma.job.create({
      data: jobData,
      include: {
        company: {
          select: {
            id: true,
            name: true,
            legalName: true,
            slug: true,
            logoUrl: true,
            isGood: true,
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
      slug: job.slug,
      locations: job.locations,
      wardCodes: job.wardCodes,
      specificAddress: job.specificAddress,
      ...(job.locations.length > 0 ? { location: getProvinceNameByCode(job.locations[0]) ?? job.locations[0] } : {}),
      remote: job.remote,
      currency: job.currency,
      employmentType: job.employmentType,
      experienceLevel: job.experienceLevel,
      tags: job.tags,
      isActive: job.isActive,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      company: {
        id: job.company.id,
        name: job.company.name,
        ...(job.company.legalName ? { legalName: job.company.legalName } : {}),
        slug: job.company.slug,
      },
      _count: job._count,
      // Header fields
      department: job.department,
      jobLevel: job.jobLevel,
      educationLevel: job.educationLevel,
      // Required JD fields
      generalInfo: job.generalInfo,
      mission: job.mission,
      tasks: job.tasks,
      knowledge: job.knowledge,
      skills: job.skills,
      attitude: job.attitude,
    };
    
    // Optional fields
    if (job.salaryMin !== null) result.salaryMin = job.salaryMin;
    if (job.salaryMax !== null) result.salaryMax = job.salaryMax;
    if (job.applicationDeadline) result.applicationDeadline = job.applicationDeadline;
    if (job.kpis) result.kpis = job.kpis;
    if (job.authority) result.authority = job.authority;
    if (job.relationships) result.relationships = job.relationships;
    if (job.careerPath) result.careerPath = job.careerPath;
    if (job.benefitsIncome) result.benefitsIncome = job.benefitsIncome;
    if (job.benefitsPerks) result.benefitsPerks = job.benefitsPerks;
    if (job.contact) result.contact = job.contact;
    if (job.company.logoUrl) result.company.logoUrl = job.company.logoUrl;
    result.company.isGood = job.company.isGood;
    if (job.workingTimeRanges) result.workingTimeRanges = job.workingTimeRanges;
    if (job.workingTimeNote) result.workingTimeNote = job.workingTimeNote;
    if (job.worksOnSaturday !== null) result.worksOnSaturday = job.worksOnSaturday;
    

    // Sync to Elasticsearch (fire-and-forget)
    void syncJobToEs({
      id: job.id, companyId: job.companyId, slug: job.slug,
      title: job.title, generalInfo: job.generalInfo, mission: job.mission,
      tasks: job.tasks, knowledge: job.knowledge, skills: job.skills, attitude: job.attitude,
      locations: job.locations, wardCodes: job.wardCodes,
      remote: job.remote, isActive: job.isActive,
      employmentType: job.employmentType, experienceLevel: job.experienceLevel,
      jobLevel: job.jobLevel, educationLevel: job.educationLevel, gender: job.gender,
      salaryMin: job.salaryMin, salaryMax: job.salaryMax, currency: job.currency,
      tags: job.tags, applicationDeadline: job.applicationDeadline,
      createdAt: job.createdAt, updatedAt: job.updatedAt,
    });

    // Generate vector embedding (fire-and-forget)
    void generateAndStoreJobEmbedding({
      id: job.id, title: job.title, mission: job.mission, tasks: job.tasks,
      knowledge: job.knowledge, skills: job.skills, attitude: job.attitude,
      generalInfo: job.generalInfo, benefitsPerks: job.benefitsPerks, careerPath: job.careerPath,
    });

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
      reminderSentAt: null,
    };
    
    // Basic info
    if (data.title !== undefined) {
      updateData.title = data.title;
      updateData.slug = slugifyVietnamese(data.title);
    }
    if (data.locations !== undefined || data.location !== undefined || data.wardCodes !== undefined) {
      const locInput: { locations?: string[]; location?: string | null; wardCodes?: string[] } = {};
      if (data.locations !== undefined) locInput.locations = data.locations;
      if (data.location !== undefined) locInput.location = data.location;
      if (data.wardCodes !== undefined) locInput.wardCodes = data.wardCodes;
      const resolved = resolveLocationsWithWards(
        { locations: job.locations, wardCodes: job.wardCodes },
        locInput,
      );
      updateData.locations = resolved.locations;
      updateData.wardCodes = resolved.wardCodes;
    }
    if (data.remote !== undefined) updateData.remote = data.remote;
    if (data.salaryMin !== undefined) updateData.salaryMin = data.salaryMin;
    if (data.salaryMax !== undefined) updateData.salaryMax = data.salaryMax;
    if (data.currency !== undefined && data.currency !== null) updateData.currency = data.currency;
    if (data.employmentType !== undefined) updateData.employmentType = data.employmentType;
    if (data.experienceLevel !== undefined) updateData.experienceLevel = data.experienceLevel;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    // Header fields
    if (data.department !== undefined) updateData.department = data.department ?? null;
    if (data.jobLevel !== undefined) updateData.jobLevel = data.jobLevel ?? null;
    if (data.educationLevel !== undefined) updateData.educationLevel = data.educationLevel ?? null;
    if (data.gender !== undefined) updateData.gender = data.gender ?? null;
    
    // Handle applicationDeadline
    if (data.applicationDeadline !== undefined) {
      if (data.applicationDeadline) {
        const deadline = new Date(data.applicationDeadline);
        deadline.setUTCHours(12, 0, 0, 0);
        updateData.applicationDeadline = deadline;
      } else {
        updateData.applicationDeadline = null;
      }
    }
    
    // Required JD fields
    if (data.generalInfo !== undefined) updateData.generalInfo = data.generalInfo ?? '';
    if (data.mission !== undefined) updateData.mission = data.mission;
    if (data.tasks !== undefined) updateData.tasks = data.tasks;
    if (data.knowledge !== undefined) updateData.knowledge = data.knowledge;
    if (data.skills !== undefined) updateData.skills = data.skills;
    if (data.attitude !== undefined) updateData.attitude = data.attitude;
    
    // Optional JD fields
    if (data.kpis !== undefined) updateData.kpis = data.kpis ?? null;
    if (data.authority !== undefined) updateData.authority = data.authority ?? null;
    if (data.relationships !== undefined) updateData.relationships = data.relationships ?? null;
    if (data.careerPath !== undefined) updateData.careerPath = data.careerPath ?? null;
    if (data.benefitsIncome !== undefined) updateData.benefitsIncome = data.benefitsIncome ?? null;
    if (data.benefitsPerks !== undefined) updateData.benefitsPerks = data.benefitsPerks ?? null;
    if (data.contact !== undefined) updateData.contact = data.contact ?? null;
    if (data.specificAddress !== undefined) updateData.specificAddress = data.specificAddress ?? null;

    // Working time
    if (data.workingTimeRanges !== undefined) {
      const ranges = data.workingTimeRanges ?? null;
      const hasRanges = Array.isArray(ranges) && ranges.length > 0;
      updateData.workingTimeRanges = hasRanges
        ? (ranges as Prisma.InputJsonValue)
        : Prisma.JsonNull;
      updateData.worksOnSaturday = computeWorksOnSaturday(
        hasRanges ? (ranges as WorkingTimeRange[]) : null,
      );
    }
    if (data.workingTimeNote !== undefined) {
      const note = data.workingTimeNote?.trim();
      updateData.workingTimeNote = note ? note : null;
    }
    
    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: updateData,
      include: {
        company: {
          select: {
            id: true,
            name: true,
            legalName: true,
            slug: true,
            logoUrl: true,
            isGood: true,
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
      slug: updatedJob.slug,
      locations: updatedJob.locations,
      wardCodes: updatedJob.wardCodes,
      specificAddress: updatedJob.specificAddress,
      ...(updatedJob.locations.length > 0 ? { location: getProvinceNameByCode(updatedJob.locations[0]) ?? updatedJob.locations[0] } : {}),
      remote: updatedJob.remote,
      currency: updatedJob.currency,
      employmentType: updatedJob.employmentType,
      experienceLevel: updatedJob.experienceLevel,
      tags: updatedJob.tags,
      isActive: updatedJob.isActive,
      createdAt: updatedJob.createdAt,
      updatedAt: updatedJob.updatedAt,
      company: {
        id: updatedJob.company.id,
        name: updatedJob.company.name,
        ...(updatedJob.company.legalName ? { legalName: updatedJob.company.legalName } : {}),
        slug: updatedJob.company.slug,
      },
      _count: updatedJob._count,
      // Header fields
      department: updatedJob.department,
      jobLevel: updatedJob.jobLevel,
      educationLevel: updatedJob.educationLevel,
      // Required JD fields
      generalInfo: updatedJob.generalInfo,
      mission: updatedJob.mission,
      tasks: updatedJob.tasks,
      knowledge: updatedJob.knowledge,
      skills: updatedJob.skills,
      attitude: updatedJob.attitude,
    };
    
    // Optional fields
    if (updatedJob.salaryMin !== null) result.salaryMin = updatedJob.salaryMin;
    if (updatedJob.salaryMax !== null) result.salaryMax = updatedJob.salaryMax;
    if (updatedJob.applicationDeadline) result.applicationDeadline = updatedJob.applicationDeadline;
    if (updatedJob.kpis) result.kpis = updatedJob.kpis;
    if (updatedJob.authority) result.authority = updatedJob.authority;
    if (updatedJob.relationships) result.relationships = updatedJob.relationships;
    if (updatedJob.careerPath) result.careerPath = updatedJob.careerPath;
    if (updatedJob.benefitsIncome) result.benefitsIncome = updatedJob.benefitsIncome;
    if (updatedJob.benefitsPerks) result.benefitsPerks = updatedJob.benefitsPerks;
    if (updatedJob.contact) result.contact = updatedJob.contact;
    if (updatedJob.company.logoUrl) result.company.logoUrl = updatedJob.company.logoUrl;
    result.company.isGood = updatedJob.company.isGood;
    if (updatedJob.workingTimeRanges) result.workingTimeRanges = updatedJob.workingTimeRanges;
    if (updatedJob.workingTimeNote) result.workingTimeNote = updatedJob.workingTimeNote;
    if (updatedJob.worksOnSaturday !== null) result.worksOnSaturday = updatedJob.worksOnSaturday;
    

    // Sync to Elasticsearch (fire-and-forget)
    void syncJobToEs({
      id: updatedJob.id, companyId: updatedJob.companyId, slug: updatedJob.slug,
      title: updatedJob.title, generalInfo: updatedJob.generalInfo, mission: updatedJob.mission,
      tasks: updatedJob.tasks, knowledge: updatedJob.knowledge, skills: updatedJob.skills,
      attitude: updatedJob.attitude, locations: updatedJob.locations, wardCodes: updatedJob.wardCodes,
      remote: updatedJob.remote, isActive: updatedJob.isActive,
      employmentType: updatedJob.employmentType, experienceLevel: updatedJob.experienceLevel,
      jobLevel: updatedJob.jobLevel, educationLevel: updatedJob.educationLevel, gender: updatedJob.gender,
      salaryMin: updatedJob.salaryMin, salaryMax: updatedJob.salaryMax, currency: updatedJob.currency,
      tags: updatedJob.tags, applicationDeadline: updatedJob.applicationDeadline,
      createdAt: updatedJob.createdAt, updatedAt: updatedJob.updatedAt,
    });

    // Re-generate vector embedding (fire-and-forget)
    void generateAndStoreJobEmbedding({
      id: updatedJob.id, title: updatedJob.title, mission: updatedJob.mission,
      tasks: updatedJob.tasks, knowledge: updatedJob.knowledge, skills: updatedJob.skills,
      attitude: updatedJob.attitude, generalInfo: updatedJob.generalInfo,
      benefitsPerks: updatedJob.benefitsPerks, careerPath: updatedJob.careerPath,
    });

    return result;
  }

  async refreshJob(jobId: string, userId: string): Promise<void> {
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

    const membership = job.company.members[0];
    if (!membership || !['OWNER', 'ADMIN', 'MEMBER'].includes(membership.role)) {
      throw new AppError('You do not have permission to refresh this job', 403, 'FORBIDDEN');
    }

    const refreshData: Record<string, unknown> = {
      updatedAt: new Date(),
      reminderSentAt: null,
    };

    await prisma.job.update({
      where: { id: jobId },
      data: refreshData as Prisma.JobUncheckedUpdateInput,
    });
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
            legalName: true,
            slug: true,
            logoUrl: true,
            isGood: true,
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
      slug: job.slug,
      locations: job.locations,
      wardCodes: job.wardCodes,
      specificAddress: job.specificAddress,
      ...(job.locations.length > 0 ? { location: getProvinceNameByCode(job.locations[0]) ?? job.locations[0] } : {}),
      remote: job.remote,
      currency: job.currency,
      employmentType: job.employmentType,
      experienceLevel: job.experienceLevel,
      tags: job.tags,
      isActive: job.isActive,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      company: {
        id: job.company.id,
        name: job.company.name,
        ...(job.company.legalName ? { legalName: job.company.legalName } : {}),
        slug: job.company.slug,
      },
      _count: job._count,
      hasApplied,
      // Header fields
      department: job.department,
      jobLevel: job.jobLevel,
      educationLevel: job.educationLevel,
      // Required JD fields
      generalInfo: job.generalInfo,
      mission: job.mission,
      tasks: job.tasks,
      knowledge: job.knowledge,
      skills: job.skills,
      attitude: job.attitude,
    };
    
    // Optional fields
    if (job.salaryMin !== null) result.salaryMin = job.salaryMin;
    if (job.salaryMax !== null) result.salaryMax = job.salaryMax;
    if (job.applicationDeadline) result.applicationDeadline = job.applicationDeadline;
    if (job.kpis) result.kpis = job.kpis;
    if (job.authority) result.authority = job.authority;
    if (job.relationships) result.relationships = job.relationships;
    if (job.careerPath) result.careerPath = job.careerPath;
    if (job.benefitsIncome) result.benefitsIncome = job.benefitsIncome;
    if (job.benefitsPerks) result.benefitsPerks = job.benefitsPerks;
    if (job.contact) result.contact = job.contact;
    if (job.company.logoUrl) result.company.logoUrl = job.company.logoUrl;
    result.company.isGood = job.company.isGood;
    if (job.workingTimeRanges) result.workingTimeRanges = job.workingTimeRanges;
    if (job.workingTimeNote) result.workingTimeNote = job.workingTimeNote;
    if (job.worksOnSaturday !== null) result.worksOnSaturday = job.worksOnSaturday;
    
    return result;
  }

  async getRelatedJobs(jobId: string, limit = 10, userId?: string): Promise<JobWithApplication[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 10);
    const targetJob = await prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        locations: true,
        salaryMin: true,
        salaryMax: true,
      },
    });

    if (!targetJob) {
      throw new AppError('Job not found', 404, 'JOB_NOT_FOUND');
    }

    const salaryRangeMin = targetJob.salaryMin ?? targetJob.salaryMax;
    const salaryRangeMax = targetJob.salaryMax ?? targetJob.salaryMin;
    const relatedConditions: any[] = [];

    if (targetJob.locations.length > 0) {
      relatedConditions.push({
        locations: { hasSome: targetJob.locations },
      });
    }

    if (salaryRangeMin !== null && salaryRangeMax !== null) {
      relatedConditions.push({
        AND: [
          { salaryMin: { not: null } },
          { salaryMax: { not: null } },
          { salaryMin: { lte: salaryRangeMax } },
          { salaryMax: { gte: salaryRangeMin } },
        ],
      });
    }

    const relatedWhere: any = {
      id: { not: jobId },
      isActive: true,
    };
    if (relatedConditions.length > 0) {
      relatedWhere.OR = relatedConditions;
    }

    const candidates = await prisma.job.findMany({
      where: relatedWhere,
      take: safeLimit * 4,
      orderBy: { createdAt: 'desc' },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            legalName: true,
            slug: true,
            logoUrl: true,
            isGood: true,
          },
        },
        _count: {
          select: {
            applications: true,
          },
        },
      },
    });

    const scoredCandidates = candidates
      .map((candidate) => {
        const locationMatched =
          targetJob.locations.length > 0 &&
          candidate.locations.some((locationCode) => targetJob.locations.includes(locationCode));
        const salaryMatched =
          salaryRangeMin !== null &&
          salaryRangeMax !== null &&
          candidate.salaryMin !== null &&
          candidate.salaryMax !== null &&
          candidate.salaryMin <= salaryRangeMax &&
          candidate.salaryMax >= salaryRangeMin;

        const score = (locationMatched ? 2 : 0) + (salaryMatched ? 1 : 0);
        return { candidate, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.candidate.createdAt.getTime() - a.candidate.createdAt.getTime();
      })
      .map(({ candidate }) => candidate);

    const initialRelated = scoredCandidates.slice(0, safeLimit);
    const missingCount = safeLimit - initialRelated.length;

    let fallbackJobs: typeof candidates = [];
    if (missingCount > 0) {
      fallbackJobs = await prisma.job.findMany({
        where: {
          id: { notIn: [jobId, ...initialRelated.map((job) => job.id)] },
          isActive: true,
        },
        take: missingCount,
        orderBy: { createdAt: 'desc' },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              legalName: true,
              slug: true,
              logoUrl: true,
              isGood: true,
            },
          },
          _count: {
            select: {
              applications: true,
            },
          },
        },
      });
    }

    const relatedJobs = [...initialRelated, ...fallbackJobs].slice(0, safeLimit);
    const jobIds = relatedJobs.map((job) => job.id);

    const appliedJobIds = new Set<string>();
    if (userId && jobIds.length > 0) {
      const applications = await prisma.application.findMany({
        where: {
          userId,
          jobId: { in: jobIds },
        },
        select: {
          jobId: true,
        },
      });
      applications.forEach((application) => appliedJobIds.add(application.jobId));
    }

    return relatedJobs.map((job) => {
      const result: any = {
        id: job.id,
        companyId: job.companyId,
        title: job.title,
        slug: job.slug,
        locations: job.locations,
        wardCodes: job.wardCodes,
        specificAddress: job.specificAddress,
        ...(job.locations.length > 0 ? { location: getProvinceNameByCode(job.locations[0]) ?? job.locations[0] } : {}),
        remote: job.remote,
        currency: job.currency,
        employmentType: job.employmentType,
        experienceLevel: job.experienceLevel,
        tags: job.tags,
        isActive: job.isActive,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        company: {
          id: job.company.id,
          name: job.company.name,
          ...(job.company.legalName ? { legalName: job.company.legalName } : {}),
          slug: job.company.slug,
        },
        _count: job._count,
        hasApplied: appliedJobIds.has(job.id),
        // Header fields
        department: job.department,
        jobLevel: job.jobLevel,
        educationLevel: job.educationLevel,
        // Required JD fields
        generalInfo: job.generalInfo,
        mission: job.mission,
        tasks: job.tasks,
        knowledge: job.knowledge,
        skills: job.skills,
        attitude: job.attitude,
      };

      // Optional fields
      if (job.salaryMin !== null) result.salaryMin = job.salaryMin;
      if (job.salaryMax !== null) result.salaryMax = job.salaryMax;
      if (job.applicationDeadline) result.applicationDeadline = job.applicationDeadline;
      if (job.kpis) result.kpis = job.kpis;
      if (job.authority) result.authority = job.authority;
      if (job.relationships) result.relationships = job.relationships;
      if (job.careerPath) result.careerPath = job.careerPath;
      if (job.benefitsIncome) result.benefitsIncome = job.benefitsIncome;
      if (job.benefitsPerks) result.benefitsPerks = job.benefitsPerks;
      if (job.contact) result.contact = job.contact;
      if (job.company.logoUrl) result.company.logoUrl = job.company.logoUrl;
      result.company.isGood = job.company.isGood;
      if (job.workingTimeRanges) result.workingTimeRanges = job.workingTimeRanges;
      if (job.workingTimeNote) result.workingTimeNote = job.workingTimeNote;
      if (job.worksOnSaturday !== null) result.worksOnSaturday = job.worksOnSaturday;

      return result;
    });
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
    // Try Elasticsearch first for text/skills queries
    if (data.q || data.skills) {
      try {
        const ids = await this.searchJobsInEs(data);
        if (ids !== null) {
          return await this.fetchJobsByIds(ids, data.page, data.limit, userId);
        }
      } catch (err) {
        console.warn('[ES] Job search failed, falling back to Prisma:', err);
      }
    }

    const { q, location, ward, remote, employmentType, experienceLevel, jobLevel, educationLevel, gender, salaryMin, salaryMax, salaryCurrency, skills, companyId, isActive, worksOnSaturday, page, limit } = data;
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
        { generalInfo: { contains: q, mode: 'insensitive' } },
        { mission: { contains: q, mode: 'insensitive' } },
        { tasks: { contains: q, mode: 'insensitive' } },
        { knowledge: { contains: q, mode: 'insensitive' } },
        { skills: { contains: q, mode: 'insensitive' } },
        { attitude: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (location) {
      const normalizedLocation = resolveProvinceCode(location) ?? location;
      where.locations = { has: normalizedLocation };
    }

    if (ward) {
      where.wardCodes = { has: ward };
    }

    if (remote !== undefined) {
      where.remote = remote;
    }

    if (employmentType) {
      where.employmentType = employmentType;
    }

    // Build nullable field filters
    // If JD has no value for a nullable field, it matches any filter value
    const nullableFieldFilters: any[] = [];

    // jobLevel is nullable - match null OR exact value
    if (jobLevel) {
      nullableFieldFilters.push({
        OR: [
          { jobLevel: null },
          { jobLevel: jobLevel },
        ],
      });
    }

    // educationLevel is nullable - match null OR exact value
    if (educationLevel) {
      nullableFieldFilters.push({
        OR: [
          { educationLevel: null },
          { educationLevel: educationLevel },
        ],
      });
    }

    // gender is nullable - match null OR exact value
    if (gender) {
      nullableFieldFilters.push({
        OR: [
          { gender: null },
          { gender: gender },
        ],
      });
    }

    if (nullableFieldFilters.length > 0) {
      where.AND = [...(where.AND ?? []), ...nullableFieldFilters];
    }

    // experienceLevel always has a default value, so we do exact match only
    if (experienceLevel) {
      where.experienceLevel = experienceLevel;
    }

    // Salary filter: match if JD has no salary set OR salary ranges overlap
    if (salaryMin !== undefined || salaryMax !== undefined) {
      // Jobs without salary set (both null) match any salary filter
      // Jobs with salary set need to have overlapping range with user filter
      const salaryConditions: any[] = [];

      // JD with no salary set matches
      salaryConditions.push({
        AND: [
          { salaryMin: null },
          { salaryMax: null },
        ],
      });

      // JD with salary set - check overlap
      // Overlap: JD.salaryMin <= user.salaryMax AND JD.salaryMax >= user.salaryMin
      const overlapCondition: any = { AND: [] };

      if (salaryMin !== undefined) {
        overlapCondition.AND.push({ salaryMax: { gte: salaryMin } });
      }
      if (salaryMax !== undefined) {
        overlapCondition.AND.push({ salaryMin: { lte: salaryMax } });
      }
      if (salaryCurrency) {
        overlapCondition.AND.push({ currency: salaryCurrency });
      }

      if (overlapCondition.AND.length > 0) {
        salaryConditions.push(overlapCondition);
      }

      where.AND = [...(where.AND ?? []), { OR: salaryConditions }];
    }

    if (skills) {
      // Search in skills text field (rich text/markdown)
      const skillTerms = skills.split(',').map(s => s.trim());
      where.OR = where.OR || [];
      skillTerms.forEach(term => {
        where.OR.push({ skills: { contains: term, mode: 'insensitive' } });
      });
    }

    if (companyId) {
      where.companyId = companyId;
    }

    if (worksOnSaturday) {
      if (worksOnSaturday === 'WORK') {
        where.worksOnSaturday = true;
      } else if (worksOnSaturday === 'REST') {
        where.worksOnSaturday = false;
      } else if (worksOnSaturday === 'UNSPECIFIED') {
        where.worksOnSaturday = null;
      }
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
              legalName: true,
              slug: true,
              logoUrl: true,
              isGood: true,
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
        slug: job.slug,
        locations: job.locations,
        wardCodes: job.wardCodes,
        specificAddress: job.specificAddress,
        ...(job.locations.length > 0 ? { location: getProvinceNameByCode(job.locations[0]) ?? job.locations[0] } : {}),
        remote: job.remote,
        currency: job.currency,
        employmentType: job.employmentType,
        experienceLevel: job.experienceLevel,
        tags: job.tags,
        isActive: job.isActive,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        company: {
          id: job.company.id,
          name: job.company.name,
          ...(job.company.legalName ? { legalName: job.company.legalName } : {}),
          slug: job.company.slug,
        },
        _count: job._count,
        hasApplied,
        // Header fields
        department: job.department,
        jobLevel: job.jobLevel,
        educationLevel: job.educationLevel,
        gender: job.gender,
        // Required JD fields
        generalInfo: job.generalInfo,
        mission: job.mission,
        tasks: job.tasks,
        knowledge: job.knowledge,
        skills: job.skills,
        attitude: job.attitude,
      };

      // Optional fields
      if (job.salaryMin !== null) jobResult.salaryMin = job.salaryMin;
      if (job.salaryMax !== null) jobResult.salaryMax = job.salaryMax;
      if (job.applicationDeadline) jobResult.applicationDeadline = job.applicationDeadline;
      if (job.kpis) jobResult.kpis = job.kpis;
      if (job.authority) jobResult.authority = job.authority;
      if (job.relationships) jobResult.relationships = job.relationships;
      if (job.careerPath) jobResult.careerPath = job.careerPath;
      if (job.benefitsIncome) jobResult.benefitsIncome = job.benefitsIncome;
      if (job.benefitsPerks) jobResult.benefitsPerks = job.benefitsPerks;
      if (job.contact) jobResult.contact = job.contact;
      if (job.company.logoUrl) jobResult.company.logoUrl = job.company.logoUrl;
      jobResult.company.isGood = job.company.isGood;
      if (job.workingTimeRanges) jobResult.workingTimeRanges = job.workingTimeRanges;
      if (job.workingTimeNote) jobResult.workingTimeNote = job.workingTimeNote;
      if (job.worksOnSaturday !== null) jobResult.worksOnSaturday = job.worksOnSaturday;
      
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
      include: {
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!job) {
      throw new AppError('Job not found', 404, 'JOB_NOT_FOUND');
    }

    if (!job.isActive) {
      throw new AppError('Job is no longer active', 400, 'JOB_INACTIVE');
    }

    if (job.applicationDeadline && job.applicationDeadline.getTime() < Date.now()) {
      throw new AppError('Đã hết hạn ứng tuyển cho việc làm này', 400, 'APPLICATION_DEADLINE_PASSED');
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
      throw new AppError('Lỗi: Bạn đã từng ứng tuyển cho vị trí này rồi', 409, 'ALREADY_APPLIED');
    }

    const applicant = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    // Create application
    const createdApplication = await prisma.application.create({
      data: {
        userId,
        jobId: data.jobId,
        coverLetter: data.coverLetter ?? null,
        resumeUrl: data.resumeUrl ?? null,
        status: 'RECEIVED',
      },
    });

    const interactionData: Record<string, unknown> = {
      updatedAt: new Date(),
      reminderSentAt: null,
    };

    await prisma.job.update({
      where: { id: job.id },
      data: interactionData as Prisma.JobUncheckedUpdateInput,
    });

    const companyAdmins = await prisma.companyMember.findMany({
      where: {
        companyId: job.companyId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const companyAdminIds = companyAdmins.map((member) => member.userId);
    const applicantName = applicant?.name || applicant?.email || 'Ứng viên';
    const manageApplicationsUrl = `${config.FRONTEND_ORIGIN}/companies/${job.company.slug}/manage?tab=applications&jobId=${job.id}`;
    const appliedAtLabel = createdApplication.appliedAt.toLocaleString('vi-VN');

    if (companyAdminIds.length > 0) {
      notificationService
        .createNotificationsForUsers(companyAdminIds, {
          type: NotificationType.JOB_APPLICATION,
          title: `Ứng viên mới cho vị trí ${job.title}`,
          content: `${applicantName} vừa ứng tuyển vào vị trí ${job.title}.`,
          metadata: {
            applicationId: createdApplication.id,
            jobId: job.id,
            companyId: job.company.id,
            applicantId: userId,
          },
          relatedEntityType: 'APPLICATION',
          relatedEntityId: createdApplication.id,
        })
        .catch(() => {});

      const verifiedEmails = await getVerifiedEmailsForUsers(companyAdminIds);
      await Promise.all(
        companyAdmins.map((member) => {
          const verifiedEmail = verifiedEmails.get(member.userId);
          if (!verifiedEmail) {
            return Promise.resolve();
          }

          return emailService
            .sendNewApplicationEmail(verifiedEmail, {
              recipientName: member.user.name,
              applicantName,
              jobTitle: job.title,
              companyName: job.company.name,
              appliedAt: appliedAtLabel,
              applicationUrl: manageApplicationsUrl,
            })
            .catch(() => {});
        }),
      );
    }
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
                  isGood: true,
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
          slug: app.job.slug,
          title: app.job.title,
          company: {
            id: app.job.company.id,
            name: app.job.company.name,
            slug: app.job.company.slug,
            ...(app.job.company.logoUrl ? { logoUrl: app.job.company.logoUrl } : {}),
            isGood: app.job.company.isGood,
          },
        },
        user: {
          id: app.user.id,
          name: app.user.name ?? undefined,
          email: app.user.email,
          slug: app.user.slug ?? undefined,
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
        user: {
          select: {
            id: true,
            name: true,
            email: true,
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

    const prevNotes = (application.notes ?? '').trim();
    const notesProvided = data.notes !== undefined;
    const nextNotesTrimmed = notesProvided ? (data.notes ?? '').trim() : prevNotes;
    const statusChanged = data.status !== application.status;
    const notesChanged = notesProvided && prevNotes !== nextNotesTrimmed;

    if (!statusChanged && !notesChanged) {
      return;
    }

    const updateData: Prisma.ApplicationUncheckedUpdateInput = {
      updatedAt: new Date(),
    };
    if (statusChanged) {
      updateData.status = data.status;
    }
    if (notesProvided) {
      updateData.notes = nextNotesTrimmed === '' ? null : nextNotesTrimmed;
    }

    await prisma.application.update({
      where: { id: data.applicationId },
      data: updateData,
    });

    const effectiveStatus = statusChanged ? data.status : application.status;
    const statusLabel = APPLICATION_STATUS_LABEL[effectiveStatus] || effectiveStatus;
    const jobTitle = application.job.title;
    const companyName = application.job.company.name;
    const myApplicationsUrl = `${config.FRONTEND_ORIGIN}/applications`;

    let notifTitle = 'Đơn ứng tuyển đã được cập nhật';
    let notifContent = '';
    if (statusChanged && notesChanged) {
      notifContent = `Đơn ứng tuyển vị trí ${jobTitle} tại ${companyName} đã chuyển sang trạng thái ${statusLabel} và có cập nhật thông tin kèm theo.`;
    } else if (statusChanged) {
      notifContent = `Đơn ứng tuyển vị trí ${jobTitle} tại ${companyName} đã chuyển sang trạng thái ${statusLabel}.`;
    } else {
      notifContent = `Nhà tuyển dụng đã cập nhật thông tin liên quan đến đơn ứng tuyển của bạn cho vị trí ${jobTitle} tại ${companyName}.`;
    }

    notificationService
      .createNotification({
        userId: application.userId,
        type: NotificationType.APPLICATION_STATUS,
        title: notifTitle,
        content: notifContent,
        metadata: {
          applicationId: application.id,
          jobId: application.jobId,
          status: effectiveStatus,
          statusChanged,
          notesChanged,
        },
        relatedEntityType: 'APPLICATION',
        relatedEntityId: application.id,
      })
      .catch(() => {});

    const verifiedEmail = await getVerifiedEmailForUser(application.userId);
    if (verifiedEmail) {
      emailService
        .sendApplicationStatusUpdateEmail(verifiedEmail, {
          applicantName: application.user.name,
          jobTitle,
          companyName,
          newStatus: statusLabel,
          applicationUrl: myApplicationsUrl,
          statusChanged,
          notesChanged,
        })
        .catch(() => {});
    }
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
                  isGood: true,
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
          slug: app.job.slug,
          title: app.job.title,
          company: {
            id: app.job.company.id,
            name: app.job.company.name,
            slug: app.job.company.slug,
            ...(app.job.company.logoUrl ? { logoUrl: app.job.company.logoUrl } : {}),
            isGood: app.job.company.isGood,
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
                  isGood: true,
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
          slug: fav.job.slug,
          title: fav.job.title,
          isActive: fav.job.isActive,
          locations: fav.job.locations,
          wardCodes: fav.job.wardCodes,
          ...(fav.job.locations.length > 0 ? { location: getProvinceNameByCode(fav.job.locations[0]) ?? fav.job.locations[0] } : {}),
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
            isGood: fav.job.company.isGood,
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

    // Remove from Elasticsearch (fire-and-forget)
    void deleteJobFromEs(jobId);
  }

  // ─── Elasticsearch search helpers ─────────────────────────────────────────

  private async searchJobsInEs(data: SearchJobsInput): Promise<string[] | null> {
    const client = getEsClient();
    if (!client) return null;

    const must: object[] = [];
    const filter: object[] = [];

    if (data.q) {
      must.push({
        multi_match: {
          query: data.q,
          fields: ['title^3', 'skills^2', 'generalInfo', 'mission', 'tasks', 'knowledge', 'attitude'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    if (data.skills) {
      const skillTerms = data.skills.split(',').map((s: string) => s.trim()).join(' ');
      must.push({
        multi_match: {
          query: skillTerms,
          fields: ['skills^3', 'knowledge', 'tasks'],
          type: 'best_fields',
        },
      });
    }

    const activeFilter = data.isActive !== undefined ? data.isActive : (data.companyId ? undefined : true);
    if (activeFilter !== undefined) filter.push({ term: { isActive: activeFilter } });
    if (data.remote !== undefined) filter.push({ term: { remote: data.remote } });
    if (data.employmentType) filter.push({ term: { employmentType: data.employmentType } });
    if (data.experienceLevel) filter.push({ term: { experienceLevel: data.experienceLevel } });
    if (data.companyId) filter.push({ term: { companyId: data.companyId } });

    if (data.location) {
      const code = resolveProvinceCode(data.location) ?? data.location;
      filter.push({ term: { locations: code } });
    }
    if (data.ward) filter.push({ term: { wardCodes: data.ward } });

    const buildNullableFilter = (field: string, value: string): object => ({
      bool: {
        should: [
          { term: { [field]: value } },
          { bool: { must_not: { exists: { field } } } },
        ],
        minimum_should_match: 1,
      },
    });
    if (data.jobLevel) filter.push(buildNullableFilter('jobLevel', data.jobLevel));
    if (data.educationLevel) filter.push(buildNullableFilter('educationLevel', data.educationLevel));
    if (data.gender) filter.push(buildNullableFilter('gender', data.gender));

    if (data.salaryMin !== undefined || data.salaryMax !== undefined) {
      const overlapMust: object[] = [];
      if (data.salaryMin !== undefined) overlapMust.push({ range: { salaryMax: { gte: data.salaryMin } } });
      if (data.salaryMax !== undefined) overlapMust.push({ range: { salaryMin: { lte: data.salaryMax } } });
      if (data.salaryCurrency) overlapMust.push({ term: { currency: data.salaryCurrency } });

      filter.push({
        bool: {
          should: [
            // Jobs without salary set match all salary filters
            { bool: { must_not: [{ exists: { field: 'salaryMin' } }, { exists: { field: 'salaryMax' } }] } },
            // Jobs with overlapping range
            { bool: { must: overlapMust } },
          ],
          minimum_should_match: 1,
        },
      });
    }

    const response = await client.search({
      index: JOBS_INDEX,
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

  private async fetchJobsByIds(
    ids: string[],
    page: number,
    limit: number,
    userId?: string,
  ): Promise<{ jobs: JobWithApplication[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    if (ids.length === 0) {
      return { jobs: [], pagination: { page, limit, total: 0, totalPages: 0 } };
    }

    const jobs = await prisma.job.findMany({
      where: { id: { in: ids } },
      include: {
        company: {
          select: { id: true, name: true, legalName: true, slug: true, logoUrl: true, isGood: true },
        },
        _count: { select: { applications: true } },
      },
    });

    // Restore ES relevance order
    const jobMap = new Map(jobs.map(j => [j.id, j]));
    const orderedJobs = ids.map(id => jobMap.get(id)).filter(Boolean) as typeof jobs;

    const jobsWithApplications: JobWithApplication[] = [];
    for (const job of orderedJobs) {
      let hasApplied = false;
      if (userId) {
        const application = await prisma.application.findUnique({
          where: { userId_jobId: { userId, jobId: job.id } },
        });
        hasApplied = !!application;
      }

      const jobResult: any = {
        id: job.id, companyId: job.companyId, title: job.title, slug: job.slug,
        locations: job.locations, wardCodes: job.wardCodes, specificAddress: job.specificAddress,
        ...(job.locations.length > 0 ? { location: getProvinceNameByCode(job.locations[0]) ?? job.locations[0] } : {}),
        remote: job.remote, currency: job.currency,
        employmentType: job.employmentType, experienceLevel: job.experienceLevel,
        tags: job.tags, isActive: job.isActive,
        createdAt: job.createdAt, updatedAt: job.updatedAt,
        company: {
          id: job.company.id, name: job.company.name,
          ...(job.company.legalName ? { legalName: job.company.legalName } : {}),
          slug: job.company.slug,
        },
        _count: job._count, hasApplied,
        department: job.department, jobLevel: job.jobLevel, educationLevel: job.educationLevel, gender: job.gender,
        generalInfo: job.generalInfo, mission: job.mission, tasks: job.tasks,
        knowledge: job.knowledge, skills: job.skills, attitude: job.attitude,
      };

      if (job.salaryMin !== null) jobResult.salaryMin = job.salaryMin;
      if (job.salaryMax !== null) jobResult.salaryMax = job.salaryMax;
      if (job.applicationDeadline) jobResult.applicationDeadline = job.applicationDeadline;
      if (job.kpis) jobResult.kpis = job.kpis;
      if (job.authority) jobResult.authority = job.authority;
      if (job.relationships) jobResult.relationships = job.relationships;
      if (job.careerPath) jobResult.careerPath = job.careerPath;
      if (job.benefitsIncome) jobResult.benefitsIncome = job.benefitsIncome;
      if (job.benefitsPerks) jobResult.benefitsPerks = job.benefitsPerks;
      if (job.contact) jobResult.contact = job.contact;
      if (job.company.logoUrl) jobResult.company.logoUrl = job.company.logoUrl;
      jobResult.company.isGood = job.company.isGood;

      jobsWithApplications.push(jobResult);
    }

    return {
      jobs: jobsWithApplications,
      pagination: { page, limit, total: ids.length, totalPages: Math.ceil(ids.length / limit) },
    };
  }

  // ─── Semantic (pgvector) search ───────────────────────────────────────────

  async semanticSearch(params: {
    query: string;
    limit?: number;
    location?: string;
    employmentType?: string;
    jobLevel?: string;
    salaryMin?: number;
    salaryMax?: number;
  }): Promise<{ jobs: SemanticJobResult[] }> {
    const limit = Math.min(params.limit ?? 5, 10);

    const embedding = await generateEmbedding(params.query);
    const vectorLiteral = `[${embedding.join(',')}]`;

    type Row = {
      id: string;
      title: string;
      slug: string | null;
      salaryMin: number | null;
      salaryMax: number | null;
      currency: string;
      locations: string[];
      remote: boolean;
      employmentType: string;
      jobLevel: string | null;
      benefitsIncome: string | null;
      companyId: string;
      companyName: string;
      companyLegalName: string | null;
      companySlug: string;
      logoUrl: string | null;
      isGood: boolean;
      similarity: number;
    };

    // Chuẩn hóa địa điểm về mã tỉnh chuẩn (vd: "Hà Nội"/"Hanoi" -> "ha-noi"),
    // tránh phụ thuộc việc LLM tự map. Nếu không resolve được thì giữ nguyên giá
    // trị thô (có thể đã là mã hợp lệ); nếu rỗng thì bỏ filter địa điểm.
    const locationFilter = params.location
      ? resolveProvinceCode(params.location) ?? params.location
      : null;
    const employmentTypeFilter = params.employmentType ?? null;
    const jobLevelFilter = params.jobLevel ?? null;

    const rows = await prisma.$queryRawUnsafe<Row[]>(
      `SELECT
        j.id,
        j.title,
        j.slug,
        j."salaryMin",
        j."salaryMax",
        j.currency,
        j.locations,
        j.remote,
        j."employmentType",
        j."jobLevel",
        j."benefitsIncome",
        c.id AS "companyId",
        c.name AS "companyName",
        c."legalName" AS "companyLegalName",
        c.slug AS "companySlug",
        c."logoUrl",
        c."isGood",
        1 - (j.embedding <=> $1::vector) AS similarity
      FROM jobs j
      JOIN companies c ON c.id = j."companyId"
      WHERE j."isActive" = true
        AND j.embedding IS NOT NULL
        AND ($2::text IS NULL OR j.locations @> ARRAY[$2]::text[])
        AND ($3::text IS NULL OR j."employmentType"::text = $3)
        AND ($4::text IS NULL OR j."jobLevel"::text = $4)
      ORDER BY j.embedding <=> $1::vector
      LIMIT $5`,
      vectorLiteral,
      locationFilter,
      employmentTypeFilter,
      jobLevelFilter,
      limit,
    );

    const jobs: SemanticJobResult[] = rows.map(row => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      companyId: row.companyId,
      companyName: row.companyName,
      companyLegalName: row.companyLegalName ?? null,
      companySlug: row.companySlug,
      logoUrl: row.logoUrl ?? null,
      isGood: row.isGood,
      locations: row.locations,
      remote: row.remote,
      employmentType: row.employmentType,
      jobLevel: row.jobLevel ?? null,
      salaryMin: row.salaryMin ?? null,
      salaryMax: row.salaryMax ?? null,
      currency: row.currency,
      benefitsIncome: row.benefitsIncome ?? null,
      similarity: Number(row.similarity),
      url: row.slug ? `/jobs/${row.slug}--${row.id}` : `/jobs/${row.id}`,
    }));

    return { jobs };
  }
}

export interface SemanticJobResult {
  id: string;
  title: string;
  slug: string | null;
  companyId: string;
  companyName: string;
  companyLegalName: string | null;
  companySlug: string;
  logoUrl: string | null;
  isGood: boolean;
  locations: string[];
  remote: boolean;
  employmentType: string;
  jobLevel: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string;
  benefitsIncome: string | null;
  similarity: number;
  url: string;
}
