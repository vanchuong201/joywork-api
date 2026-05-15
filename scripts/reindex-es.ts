/**
 * One-time backfill script: indexes all existing Prisma records into Elasticsearch.
 * Run after setting up ES: npx tsx scripts/reindex-es.ts
 */
import { config as loadEnv } from 'dotenv';
loadEnv();

import { prisma } from '../src/shared/database/prisma';
import { initializeIndices } from '../src/shared/elasticsearch/indices';
import { syncJobToEs, syncCompanyToEs, syncUserToEs } from '../src/shared/elasticsearch/sync';

const BATCH_SIZE = 500;

async function reindexJobs(): Promise<void> {
  console.log('📦 Reindexing jobs...');
  let skip = 0;
  let total = 0;

  while (true) {
    const jobs = await prisma.job.findMany({ skip, take: BATCH_SIZE });
    if (jobs.length === 0) break;

    await Promise.all(jobs.map(job => syncJobToEs({
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
    })));

    total += jobs.length;
    skip += BATCH_SIZE;
    console.log(`  ✅ Jobs indexed: ${total}`);
    if (jobs.length < BATCH_SIZE) break;
  }

  console.log(`✅ Jobs done: ${total} total`);
}

async function reindexCompanies(): Promise<void> {
  console.log('📦 Reindexing companies...');
  let skip = 0;
  let total = 0;

  while (true) {
    const companies = await prisma.company.findMany({ skip, take: BATCH_SIZE });
    if (companies.length === 0) break;

    await Promise.all(companies.map(company => syncCompanyToEs({
      id: company.id, slug: company.slug, name: company.name, legalName: company.legalName,
      tagline: company.tagline, description: company.description,
      industry: company.industry, location: company.location, size: company.size,
      isVerified: company.isVerified, createdAt: company.createdAt,
    })));

    total += companies.length;
    skip += BATCH_SIZE;
    console.log(`  ✅ Companies indexed: ${total}`);
    if (companies.length < BATCH_SIZE) break;
  }

  console.log(`✅ Companies done: ${total} total`);
}

async function reindexUsers(): Promise<void> {
  console.log('📦 Reindexing users...');
  let skip = 0;
  let total = 0;

  while (true) {
    const users = await prisma.user.findMany({
      skip,
      take: BATCH_SIZE,
      select: {
        id: true, name: true, email: true, slug: true, createdAt: true,
        profile: { select: { headline: true, bio: true, skills: true, locations: true, isPublic: true, isSearchingJob: true } },
      },
    });
    if (users.length === 0) break;

    await Promise.all(users.map(user => syncUserToEs(user)));

    total += users.length;
    skip += BATCH_SIZE;
    console.log(`  ✅ Users indexed: ${total}`);
    if (users.length < BATCH_SIZE) break;
  }

  console.log(`✅ Users done: ${total} total`);
}

async function main(): Promise<void> {
  if (!process.env['ELASTICSEARCH_URL']) {
    console.error('❌ ELASTICSEARCH_URL is not set. Please set it in your .env file.');
    process.exit(1);
  }

  console.log('🚀 Starting Elasticsearch reindex...');
  console.log(`   ES: ${process.env['ELASTICSEARCH_URL']}`);

  await prisma.$connect();

  await initializeIndices();
  await reindexJobs();
  await reindexCompanies();
  await reindexUsers();

  console.log('\n✅ Reindex complete!');
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('❌ Reindex failed:', err);
  process.exit(1);
});
