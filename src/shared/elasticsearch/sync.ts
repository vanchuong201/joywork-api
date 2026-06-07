import { getEsClient } from './client';
import { JOBS_INDEX, COMPANIES_INDEX, USERS_INDEX } from './indices';

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export interface JobForEs {
  id: string;
  companyId: string;
  slug: string | null;
  title: string;
  generalInfo: string;
  mission: string;
  tasks: string;
  knowledge: string;
  skills: string;
  attitude: string;
  locations: string[];
  wardCodes: string[];
  remote: boolean;
  isActive: boolean;
  employmentType: string;
  experienceLevel: string;
  jobLevel: string | null;
  educationLevel: string | null;
  gender: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string;
  tags: string[];
  applicationDeadline: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function syncJobToEs(job: JobForEs): Promise<void> {
  const client = getEsClient();
  if (!client) return;
  try {
    const doc: Record<string, unknown> = {
      id: job.id,
      companyId: job.companyId,
      slug: job.slug,
      title: job.title,
      generalInfo: job.generalInfo,
      mission: job.mission,
      tasks: job.tasks,
      knowledge: job.knowledge,
      skills: job.skills,
      attitude: job.attitude,
      locations: job.locations,
      wardCodes: job.wardCodes,
      remote: job.remote,
      isActive: job.isActive,
      employmentType: job.employmentType,
      experienceLevel: job.experienceLevel,
      currency: job.currency,
      tags: job.tags,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
    if (job.jobLevel != null) doc['jobLevel'] = job.jobLevel;
    if (job.educationLevel != null) doc['educationLevel'] = job.educationLevel;
    if (job.gender != null) doc['gender'] = job.gender;
    if (job.salaryMin != null) doc['salaryMin'] = job.salaryMin;
    if (job.salaryMax != null) doc['salaryMax'] = job.salaryMax;
    if (job.applicationDeadline != null) doc['applicationDeadline'] = job.applicationDeadline;

    await client.index({ index: JOBS_INDEX, id: job.id, document: doc });
  } catch (err) {
    console.error(`[ES] Failed to sync job ${job.id}:`, err);
  }
}

export async function deleteJobFromEs(jobId: string): Promise<void> {
  const client = getEsClient();
  if (!client) return;
  try {
    await client.delete({ index: JOBS_INDEX, id: jobId });
  } catch (err) {
    // 404 means already gone — not an error worth logging
    const status = (err as { statusCode?: number })?.statusCode;
    if (status !== 404) {
      console.error(`[ES] Failed to delete job ${jobId}:`, err);
    }
  }
}

// ─── Companies ────────────────────────────────────────────────────────────────

export interface CompanyForEs {
  id: string;
  slug: string;
  name: string;
  legalName: string | null;
  tagline: string | null;
  description: string | null;
  industry: string | null;
  location: string | null;
  size: string | null;
  isVerified: boolean;
  createdAt: Date;
}

export async function syncCompanyToEs(company: CompanyForEs): Promise<void> {
  const client = getEsClient();
  if (!client) return;
  try {
    const doc: Record<string, unknown> = {
      id: company.id,
      slug: company.slug,
      name: company.name,
      isVerified: company.isVerified,
      createdAt: company.createdAt,
    };
    if (company.legalName != null) doc['legalName'] = company.legalName;
    if (company.tagline != null) doc['tagline'] = company.tagline;
    if (company.description != null) doc['description'] = company.description;
    if (company.industry != null) doc['industry'] = company.industry;
    if (company.location != null) doc['location'] = company.location;
    if (company.size != null) doc['size'] = company.size;

    await client.index({ index: COMPANIES_INDEX, id: company.id, document: doc });
  } catch (err) {
    console.error(`[ES] Failed to sync company ${company.id}:`, err);
  }
}

export async function deleteCompanyFromEs(companyId: string): Promise<void> {
  const client = getEsClient();
  if (!client) return;
  try {
    await client.delete({ index: COMPANIES_INDEX, id: companyId });
  } catch (err) {
    const status = (err as { statusCode?: number })?.statusCode;
    if (status !== 404) {
      console.error(`[ES] Failed to delete company ${companyId}:`, err);
    }
  }
}

// ─── Users ────────────────────────────────────────────────────────────────────

export interface UserForEs {
  id: string;
  name: string | null;
  email: string;
  slug: string | null;
  profile: {
    headline: string | null;
    bio: string | null;
    skills: string[];
    locations: string[];
    isPublic: boolean;
    isSearchingJob: boolean;
  } | null;
  createdAt: Date;
}

export async function syncUserToEs(user: UserForEs): Promise<void> {
  const client = getEsClient();
  if (!client) return;
  try {
    const doc: Record<string, unknown> = {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      isPublic: user.profile?.isPublic ?? false,
      isSearchingJob: user.profile?.isSearchingJob ?? false,
      profileSkills: user.profile?.skills ?? [],
      profileLocations: user.profile?.locations ?? [],
    };
    if (user.name != null) doc['name'] = user.name;
    if (user.slug != null) doc['slug'] = user.slug;
    if (user.profile?.headline != null) doc['headline'] = user.profile.headline;
    if (user.profile?.bio != null) doc['bio'] = user.profile.bio;

    await client.index({ index: USERS_INDEX, id: user.id, document: doc });
  } catch (err) {
    console.error(`[ES] Failed to sync user ${user.id}:`, err);
  }
}

export async function deleteUserFromEs(userId: string): Promise<void> {
  const client = getEsClient();
  if (!client) return;
  try {
    await client.delete({ index: USERS_INDEX, id: userId });
  } catch (err) {
    const status = (err as { statusCode?: number })?.statusCode;
    if (status !== 404) {
      console.error(`[ES] Failed to delete user ${userId}:`, err);
    }
  }
}
