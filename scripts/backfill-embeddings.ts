/**
 * One-time script to generate vector embeddings for all jobs that don't have one.
 * Run: npm run embed:backfill
 */

import { config as loadEnv } from 'dotenv';
loadEnv();

import { prisma } from '../src/shared/database/prisma';
import {
  buildJobText,
  generateEmbedding,
  upsertJobEmbedding,
} from '../src/shared/services/embedding.service';

const BATCH_SIZE = 20;
const SLEEP_MS = 100;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('[backfill] Starting job embedding backfill...');

  // Find jobs without embeddings (use raw SQL since Prisma can't filter Unsupported type)
  const allJobs = await prisma.$queryRaw<Array<{
    id: string;
    title: string;
    mission: string;
    tasks: string;
    knowledge: string;
    skills: string;
    attitude: string;
    generalInfo: string;
    benefitsPerks: string | null;
    careerPath: string | null;
  }>>`
    SELECT id, title, mission, tasks, knowledge, skills, attitude,
           "generalInfo", "benefitsPerks", "careerPath"
    FROM jobs
    WHERE "isActive" = true AND embedding IS NULL
  `;

  console.log(`[backfill] Found ${allJobs.length} jobs without embeddings`);

  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < allJobs.length; i += BATCH_SIZE) {
    const batch = allJobs.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async job => {
        try {
          const text = buildJobText(job);
          const embedding = await generateEmbedding(text);
          await upsertJobEmbedding(job.id, embedding);
          succeeded++;
          process.stdout.write(`\r[backfill] Progress: ${succeeded + failed}/${allJobs.length}`);
        } catch (err) {
          failed++;
          console.error(`\n[backfill] Failed job ${job.id}:`, err instanceof Error ? err.message : err);
        }
      }),
    );

    if (i + BATCH_SIZE < allJobs.length) {
      await sleep(SLEEP_MS);
    }
  }

  console.log(`\n[backfill] Done. Succeeded: ${succeeded}, Failed: ${failed}`);
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('[backfill] Fatal error:', err);
  process.exit(1);
});
