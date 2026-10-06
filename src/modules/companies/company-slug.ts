import { prisma } from '@/shared/database/prisma';
import { slugify } from '@/shared/slug';

export const HTTP_COMPANY_SLUG_MESSAGE = 'Slug must not start with http or https';

export function isHttpDerivedCompanySlug(slug: string): boolean {
  return slug.trim().toLowerCase().startsWith('http');
}

export function normalizeCompanySlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function slugFromCompanyName(name: string): string {
  return normalizeCompanySlug(slugify(name));
}

function fallbackCompanySlug(companyId: string): string {
  const suffix = companyId.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6);
  return suffix.length > 0 ? `cong-ty-${suffix}` : 'cong-ty';
}

export async function allocateUniqueCompanySlug(params: {
  name: string;
  legalName?: string | null;
  companyId: string;
  isTaken: (slug: string) => Promise<boolean>;
}): Promise<string> {
  const sources = [params.name, params.legalName ?? ''];
  let base = '';

  for (const source of sources) {
    const candidate = slugFromCompanyName(source);
    if (candidate.length >= 2 && !isHttpDerivedCompanySlug(candidate)) {
      base = candidate;
      break;
    }
  }

  if (!base) {
    base = fallbackCompanySlug(params.companyId);
  }

  let slug = base;
  let counter = 2;
  while (await params.isTaken(slug)) {
    slug = `${base}-${counter}`;
    counter += 1;
  }

  return slug;
}

export async function findRedirectCompanyId(slug: string): Promise<string | null> {
  const row = await prisma.companySlugRedirect.findUnique({
    where: { slug },
    select: { companyId: true },
  });
  return row?.companyId ?? null;
}

export async function resolveCompanyBySlug(
  slug: string,
): Promise<{ id: string; slug: string; name: string } | null> {
  const direct = await prisma.company.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true },
  });
  if (direct) return direct;

  const companyId = await findRedirectCompanyId(slug);
  if (!companyId) return null;

  return prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, slug: true, name: true },
  });
}
