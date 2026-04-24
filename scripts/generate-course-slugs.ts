import { randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { slugify } from '../src/shared/slug';

const prisma = new PrismaClient();

function baseSlug(title: string): string {
  const s = slugify(title).slice(0, 80);
  return s || 'course';
}

async function allocateUniqueSlug(title: string, excludeCourseId?: string): Promise<string> {
  let slug = baseSlug(title);
  for (let i = 0; i < 12; i++) {
    const found = await prisma.course.findUnique({ where: { slug } });
    if (!found || (excludeCourseId && found.id === excludeCourseId)) {
      return slug;
    }
    slug = `${baseSlug(title)}-${randomBytes(3).toString('hex')}`;
  }
  throw new Error(`Cannot generate unique slug for: ${title}`);
}

async function main() {
  console.log('🚀 Starting slug regeneration for courses...\n');

  const courses = await prisma.course.findMany({
    select: { id: true, title: true, slug: true },
  });

  console.log(`Found ${courses.length} courses to process\n`);

  if (courses.length === 0) {
    console.log('No courses found!');
    return;
  }

  let successCount = 0;
  let unchangedCount = 0;
  let errorCount = 0;

  for (const course of courses) {
    try {
      const generatedSlug = await allocateUniqueSlug(course.title, course.id);

      if (course.slug === generatedSlug) {
        unchangedCount++;
        continue;
      }

      await prisma.course.update({
        where: { id: course.id },
        data: { slug: generatedSlug },
      });

      console.log(`✅ Generated slug "${generatedSlug}" for course: ${course.title}`);
      successCount++;
    } catch (error: any) {
      console.error(`❌ Error processing course ${course.id}:`, error.message);
      errorCount++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Updated: ${successCount}`);
  console.log(`   ➖ Unchanged: ${unchangedCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📝 Total: ${courses.length}`);
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
