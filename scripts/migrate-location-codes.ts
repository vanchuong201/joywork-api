import { prisma } from '@/shared/database/prisma';
import { resolveProvinceCode } from '@/shared/provinces';

async function migrateUserProfileLocations() {
  const profiles = await prisma.userProfile.findMany({
    select: { id: true, locations: true },
  });

  for (const profile of profiles) {
    const mapped = (profile.locations ?? [])
      .map((value) => resolveProvinceCode(value))
      .filter((value): value is string => Boolean(value));

    const unique = Array.from(new Set(mapped));
    await prisma.userProfile.update({
      where: { id: profile.id },
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
  await migrateUserProfileLocations();
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
