import { PrismaClient } from '@prisma/client';
import { resolveUniqueUserSlug } from '../src/modules/users/user-profile.service';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting slug backfill for users without slug...\n');

  const users = await prisma.user.findMany({
    where: { slug: null },
    select: { id: true, name: true, email: true },
  });

  console.log(`Found ${users.length} users to process\n`);

  if (users.length === 0) {
    console.log('No users missing slug.');
    return;
  }

  let successCount = 0;
  let errorCount = 0;

  for (const user of users) {
    try {
      const slug = await resolveUniqueUserSlug({
        name: user.name,
        email: user.email,
        userId: user.id,
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { slug },
      });

      console.log(`Generated slug "${slug}" for user: ${user.name || user.email}`);
      successCount++;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error processing user ${user.id}:`, message);
      errorCount++;
    }
  }

  console.log('\nSummary:');
  console.log(`   Updated: ${successCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Total: ${users.length}`);
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
