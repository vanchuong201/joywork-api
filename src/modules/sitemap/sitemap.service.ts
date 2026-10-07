import type { Prisma } from '@prisma/client';
import { prisma } from '@/shared/database/prisma';
import { buildJobUrl } from '@/shared/job-slug';
import { JobsService } from '@/modules/jobs/jobs.service';
import { searchJobsSchema } from '@/modules/jobs/jobs.schema';
import { toJobSearchQuery } from '@/modules/seo-urls/seo-urls.destinations';
import { parseStoredParams } from '@/modules/seo-urls/seo-urls.service';

export function companySitemapWhere(): Prisma.CompanyWhereInput {
  return {
    NOT: { slug: { startsWith: 'http', mode: 'insensitive' } },
    jobs: { some: { isActive: true } },
  };
}

export function jobSitemapWhere(now: Date): Prisma.JobWhereInput {
  return {
    isActive: true,
    OR: [{ applicationDeadline: null }, { applicationDeadline: { gt: now } }],
  };
}

export async function listCompaniesForSitemap() {
  const rows = await prisma.company.findMany({
    where: companySitemapWhere(),
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  });

  return rows.map((row) => ({
    slug: row.slug,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function listJobsForSitemap(now = new Date()) {
  const rows = await prisma.job.findMany({
    where: jobSitemapWhere(now),
    select: { id: true, slug: true, title: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  });

  return rows.map((row) => ({
    path: buildJobUrl(row),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function listJobCategoriesForSitemap(jobsService = new JobsService()) {
  const rows = await prisma.seoUrlMapping.findMany({
    where: { status: 'PUBLISHED', isCanonical: true },
    select: {
      seoPath: true,
      updatedAt: true,
      destinationType: true,
      destinationParams: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  const pages: Array<{ seoPath: string; updatedAt: string }> = [];
  for (const row of rows) {
    if (row.destinationType !== 'JOB_SEARCH') continue;
    const params = parseStoredParams(row.destinationParams);
    const input = searchJobsSchema.parse({ ...toJobSearchQuery(params), page: 1, limit: 1 });
    const result = await jobsService.searchJobs(input);
    if (result.pagination.total > 0) {
      pages.push({ seoPath: row.seoPath, updatedAt: row.updatedAt.toISOString() });
    }
  }
  return pages;
}
