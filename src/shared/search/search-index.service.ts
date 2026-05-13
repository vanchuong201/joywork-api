import { prisma } from '@/shared/database/prisma';
import { deleteSearchDocument, indexSearchDocument } from '@/shared/search/elasticsearch';

const serializeDate = (value: Date | null | undefined): string | null =>
  value ? value.toISOString() : null;
const serializeBigInt = (
  value: bigint | number | null | undefined
): number | null => (value == null ? null : Number(value));

export class SearchIndexService {
  async indexCompany(companyId: string): Promise<void> {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        profile: true,
      },
    });

    if (!company) {
      await deleteSearchDocument('companies', companyId);
      return;
    }

    await indexSearchDocument('companies', company.id, {
      id: company.id,
      name: company.name,
      legalName: company.legalName,
      slug: company.slug,
      tagline: company.tagline,
      description: company.description,
      logoUrl: company.logoUrl,
      coverUrl: company.coverUrl,
      website: company.website,
      location: company.location,
      wardCodes: company.wardCodes,
      industry: company.industry,
      size: company.size,
      foundedYear: company.foundedYear,
      headcount: company.headcount,
      headcountNote: company.headcountNote,
      isVerified: company.isVerified,
      verificationStatus: company.verificationStatus,
      profile: company.profile,
      createdAt: serializeDate(company.createdAt),
      updatedAt: serializeDate(company.updatedAt),
    });
  }

  async deleteCompany(companyId: string): Promise<void> {
    await deleteSearchDocument('companies', companyId);
  }

  async indexJob(jobId: string): Promise<void> {
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
            industry: true,
            isVerified: true,
          },
        },
      },
    });

    if (!job) {
      await deleteSearchDocument('jobs', jobId);
      return;
    }

    await indexSearchDocument('jobs', job.id, {
      id: job.id,
      companyId: job.companyId,
      title: job.title,
      slug: job.slug,
      locations: job.locations,
      wardCodes: job.wardCodes,
      specificAddress: job.specificAddress,
      remote: job.remote,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      currency: job.currency,
      employmentType: job.employmentType,
      experienceLevel: job.experienceLevel,
      tags: job.tags,
      applicationDeadline: serializeDate(job.applicationDeadline),
      isActive: job.isActive,
      department: job.department,
      jobLevel: job.jobLevel,
      educationLevel: job.educationLevel,
      gender: job.gender,
      generalInfo: job.generalInfo,
      mission: job.mission,
      tasks: job.tasks,
      knowledge: job.knowledge,
      skills: job.skills,
      attitude: job.attitude,
      kpis: job.kpis,
      authority: job.authority,
      relationships: job.relationships,
      careerPath: job.careerPath,
      benefitsIncome: job.benefitsIncome,
      benefitsPerks: job.benefitsPerks,
      contact: job.contact,
      company: job.company,
      createdAt: serializeDate(job.createdAt),
      updatedAt: serializeDate(job.updatedAt),
    });
  }

  async deleteJob(jobId: string): Promise<void> {
    await deleteSearchDocument('jobs', jobId);
  }

  async indexCandidate(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        experiences: {
          orderBy: [{ order: 'asc' }, { startDate: 'desc' }],
        },
        educations: {
          orderBy: [{ order: 'asc' }, { startDate: 'desc' }],
        },
      },
    });

    if (!user || !user.profile) {
      await deleteSearchDocument('candidates', userId);
      return;
    }

    await indexSearchDocument('candidates', user.id, {
      id: user.id,
      name: user.name,
      slug: user.slug,
      avatar: user.avatar,
      role: user.role,
      accountStatus: user.accountStatus,
      profile: {
        id: user.profile.id,
        userId: user.profile.userId,
        avatar: user.profile.avatar,
        headline: user.profile.headline,
        bio: user.profile.bio,
        skills: user.profile.skills,
        locations: user.profile.locations,
        wardCodes: user.profile.wardCodes,
        specificAddress: user.profile.specificAddress,
        website: user.profile.website,
        linkedin: user.profile.linkedin,
        github: user.profile.github,
        fullName: user.profile.fullName,
        title: user.profile.title,
        status: user.profile.status,
        isPublic: user.profile.isPublic,
        isSearchingJob: user.profile.isSearchingJob,
        allowCvFlip: user.profile.allowCvFlip,
        knowledge: user.profile.knowledge,
        attitude: user.profile.attitude,
        expectedSalaryMin: serializeBigInt(user.profile.expectedSalaryMin),
        expectedSalaryMax: serializeBigInt(user.profile.expectedSalaryMax),
        salaryCurrency: user.profile.salaryCurrency,
        workMode: user.profile.workMode,
        expectedCulture: user.profile.expectedCulture,
        careerGoals: user.profile.careerGoals,
        gender: user.profile.gender,
        educationLevel: user.profile.educationLevel,
        createdAt: serializeDate(user.profile.createdAt),
        updatedAt: serializeDate(user.profile.updatedAt),
      },
      experiences: user.experiences.map(experience => ({
        id: experience.id,
        role: experience.role,
        company: experience.company,
        startDate: serializeDate(experience.startDate),
        endDate: serializeDate(experience.endDate),
        period: experience.period,
        desc: experience.desc,
        achievements: experience.achievements,
        order: experience.order,
      })),
      educations: user.educations.map(education => ({
        id: education.id,
        school: education.school,
        degree: education.degree,
        startDate: serializeDate(education.startDate),
        endDate: serializeDate(education.endDate),
        period: education.period,
        gpa: education.gpa,
        honors: education.honors,
        order: education.order,
      })),
      createdAt: serializeDate(user.createdAt),
      updatedAt: serializeDate(user.updatedAt),
    });
  }

  async deleteCandidate(userId: string): Promise<void> {
    await deleteSearchDocument('candidates', userId);
  }
}

export const searchIndexService = new SearchIndexService();
