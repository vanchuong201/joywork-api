import { PrismaClient } from '@prisma/client';
import { slugifyVietnamese } from '../src/shared/job-slug';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting slug generation for jobs...\n');

  // Get all jobs — always regenerate (in case title changed or slug is incorrect)
  const jobs = await prisma.job.findMany({
    select: { id: true, title: true, slug: true },
  });

  console.log(`Found ${jobs.length} jobs to process\n`);

  if (jobs.length === 0) {
    console.log('No jobs found!');
    return;
  }

  let successCount = 0;
  let unchangedCount = 0;
  let errorCount = 0;

  for (const job of jobs) {
    try {
      const generatedSlug = slugifyVietnamese(job.title);

      if (!generatedSlug) {
        console.log(`⚠️  Skipping job ${job.id} - cannot generate slug from title`);
        errorCount++;
        continue;
      }

      // Skip if slug is already correct
      if (job.slug === generatedSlug) {
        unchangedCount++;
        continue;
      }

      await prisma.job.update({
        where: { id: job.id },
        data: { slug: generatedSlug },
      });

      console.log(`✅ Generated slug "${generatedSlug}" for job: ${job.title}`);
      successCount++;
    } catch (error: any) {
      console.error(`❌ Error processing job ${job.id}:`, error.message);
      errorCount++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Updated: ${successCount}`);
  console.log(`   ➖ Unchanged: ${unchangedCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📝 Total: ${jobs.length}`);
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
