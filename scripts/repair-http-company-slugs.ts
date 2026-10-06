import { prisma } from '@/shared/database/prisma';
import { syncCompanyToEs } from '@/shared/elasticsearch/sync';
import { allocateUniqueCompanySlug, isHttpDerivedCompanySlug } from '@/modules/companies/company-slug';

async function slugIsTaken(slug: string): Promise<boolean> {
  const [company, redirect] = await Promise.all([
    prisma.company.findUnique({ where: { slug }, select: { id: true } }),
    prisma.companySlugRedirect.findUnique({ where: { slug }, select: { id: true } }),
  ]);

  return Boolean(company || redirect);
}

async function main() {
  const companies = await prisma.company.findMany({
    where: { slug: { startsWith: 'http', mode: 'insensitive' } },
    select: {
      id: true,
      name: true,
      legalName: true,
      slug: true,
      tagline: true,
      description: true,
      industry: true,
      location: true,
      size: true,
      isVerified: true,
      createdAt: true,
    },
  });

  const targets = companies.filter((company) => isHttpDerivedCompanySlug(company.slug));
  console.log(`Found ${targets.length} companies with http/https slugs`);

  let updated = 0;
  let failed = 0;

  for (const company of targets) {
    try {
      const newSlug = await allocateUniqueCompanySlug({
        name: company.name,
        legalName: company.legalName,
        companyId: company.id,
        isTaken: (slug) => slugIsTaken(slug),
      });

      await prisma.$transaction(async (tx) => {
        const existingRedirect = await tx.companySlugRedirect.findUnique({
          where: { slug: company.slug },
          select: { companyId: true },
        });
        if (existingRedirect && existingRedirect.companyId !== company.id) {
          throw new Error(`Slug ${company.slug} already redirects to another company`);
        }
        if (!existingRedirect) {
          await tx.companySlugRedirect.create({
            data: { slug: company.slug, companyId: company.id },
          });
        }
        await tx.company.update({
          where: { id: company.id },
          data: { slug: newSlug },
        });
      });

      await syncCompanyToEs({
        id: company.id,
        slug: newSlug,
        name: company.name,
        legalName: company.legalName,
        tagline: company.tagline,
        description: company.description,
        industry: company.industry,
        location: company.location,
        size: company.size,
        isVerified: company.isVerified,
        createdAt: company.createdAt,
      });

      console.log(`Updated ${company.id}: ${company.slug} -> ${newSlug}`);
      updated += 1;
    } catch (error) {
      failed += 1;
      console.error(`Failed to repair company ${company.id}`, error);
    }
  }

  console.log(`Done. updated=${updated} failed=${failed} scanned=${targets.length}`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
