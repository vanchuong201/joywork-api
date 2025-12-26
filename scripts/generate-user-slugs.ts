import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper: Generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-'); // Replace multiple hyphens with single
}

// Helper: Ensure unique slug
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

  // Get all users without slug
  const usersWithoutSlug = await prisma.user.findMany({
    where: {
      OR: [
        { slug: null },
        { slug: '' },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  console.log(`Found ${usersWithoutSlug.length} users without slug\n`);

  if (usersWithoutSlug.length === 0) {
    console.log('✅ All users already have slugs!');
    return;
  }

  let successCount = 0;
  let errorCount = 0;

  for (const user of usersWithoutSlug) {
    try {
      // Generate slug from name or email
      const baseName = user.name?.trim() || user.email.split('@')[0];
      const baseSlug = generateSlug(baseName);
      
      if (!baseSlug) {
        console.log(`⚠️  Skipping user ${user.id} - cannot generate slug from name/email`);
        errorCount++;
        continue;
      }

      const uniqueSlug = await ensureUniqueSlug(baseSlug, user.id);

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
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📝 Total: ${usersWithoutSlug.length}`);
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

