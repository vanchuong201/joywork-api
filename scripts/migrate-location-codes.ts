import { prisma } from '@/shared/database/prisma';
import { resolveProvinceCode } from '@/shared/provinces';

async function migrateCandidateCvLocations() {
  const cvs = await prisma.candidateCv.findMany({
    select: { id: true, locations: true },
  });

  for (const cv of cvs) {
    const mapped = (cv.locations ?? [])
      .map((value) => resolveProvinceCode(value))
      .filter((value): value is string => Boolean(value));

    const unique = Array.from(new Set(mapped));
    await prisma.candidateCv.update({
      where: { id: cv.id },
      data: { locations: unique },
    });
  }
}

async function migrateJobLocations() {
  const jobs = await prisma.job.findMany({
    select: { id: true, locations: true },
  });

  for (const job of jobs) {
    const mapped = (job.locations ?? [])
      .map((value) => resolveProvinceCode(value))
      .filter((value): value is string => Boolean(value));

    const unique = Array.from(new Set(mapped));
    await prisma.job.update({
      where: { id: job.id },
      data: { locations: unique },
    });
  }
}

async function migrateCompanyLocation() {
  const companies = await prisma.company.findMany({
    select: { id: true, location: true },
  });

  for (const company of companies) {
    if (!company.location) continue;
    const mapped = resolveProvinceCode(company.location);
    if (!mapped) continue;

    await prisma.company.update({
      where: { id: company.id },
      data: { location: mapped },
    });
  }
}

async function main() {
  await migrateCandidateCvLocations();
  await migrateJobLocations();
  await migrateCompanyLocation();
  console.log('Location codes migration completed.');
}

main()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
