import { PrismaClient } from '@prisma/client';
import { slugify } from '../src/shared/slug';

const prisma = new PrismaClient();

// Helper: Ensure unique slug for users
async function ensureUniqueSlug(baseSlug: string, excludeUserId?: string): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await prisma.user.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existing || (excludeUserId && existing.id === excludeUserId)) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

async function main() {
  console.log('🚀 Starting slug generation for users...\n');

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, slug: true },
  });

  console.log(`Found ${users.length} users to process\n`);

  if (users.length === 0) {
    console.log('No users found!');
    return;
  }

  let successCount = 0;
  let unchangedCount = 0;
  let errorCount = 0;

  for (const user of users) {
    try {
      const baseName = user.name?.trim() || user.email.split('@')[0];
      const baseSlug = slugify(baseName);

      if (!baseSlug) {
        console.log(`⚠️  Skipping user ${user.id} - cannot generate slug from name/email`);
        errorCount++;
        continue;
      }

      const uniqueSlug = await ensureUniqueSlug(baseSlug, user.id);

      if (user.slug === uniqueSlug) {
        unchangedCount++;
        continue;
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { slug: uniqueSlug },
      });

      console.log(`✅ Generated slug "${uniqueSlug}" for user: ${user.name || user.email}`);
      successCount++;
    } catch (error: any) {
      console.error(`❌ Error processing user ${user.id}:`, error.message);
      errorCount++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Updated: ${successCount}`);
  console.log(`   ➖ Unchanged: ${unchangedCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📝 Total: ${users.length}`);
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
