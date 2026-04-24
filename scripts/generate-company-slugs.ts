import { PrismaClient } from '@prisma/client';
import { slugify } from '../src/shared/slug';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting slug regeneration for companies...\n');

  const companies = await prisma.company.findMany({
    select: { id: true, name: true, slug: true },
  });

  console.log(`Found ${companies.length} companies to process\n`);

  if (companies.length === 0) {
    console.log('No companies found!');
    return;
  }

  let successCount = 0;
  let unchangedCount = 0;
  let errorCount = 0;

  for (const company of companies) {
    try {
      const generatedSlug = slugify(company.name);

      if (!generatedSlug) {
        console.log(`⚠️  Skipping company ${company.id} - cannot generate slug from name`);
        errorCount++;
        continue;
      }

      // Ensure uniqueness
      let uniqueSlug = generatedSlug;
      let counter = 1;
      while (true) {
        const existing = await prisma.company.findUnique({
          where: { slug: uniqueSlug },
          select: { id: true },
        });
        if (!existing || existing.id === company.id) break;
        uniqueSlug = `${generatedSlug}-${counter}`;
        counter++;
      }

      if (company.slug === uniqueSlug) {
        unchangedCount++;
        continue;
      }

      await prisma.company.update({
        where: { id: company.id },
        data: { slug: uniqueSlug },
      });

      console.log(`✅ Generated slug "${uniqueSlug}" for company: ${company.name}`);
      successCount++;
    } catch (error: any) {
      console.error(`❌ Error processing company ${company.id}:`, error.message);
      errorCount++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Updated: ${successCount}`);
  console.log(`   ➖ Unchanged: ${unchangedCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📝 Total: ${companies.length}`);
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
