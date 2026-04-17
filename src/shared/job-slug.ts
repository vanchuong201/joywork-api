/**
 * Shared utilities for Job URL slug generation, building, and parsing.
 * Used by backend services to auto-generate slugs and build canonical URLs.
 */

const CUID_PATTERN = /^[a-z][a-z0-9]{24}$/;

/**
 * Normalize a Vietnamese title string to a URL-friendly slug.
 *
 * Steps:
 * 1. Decompose Unicode (NFD) to separate base chars from diacritics
 * 2. Remove Vietnamese diacritics (combining marks \u0300-\u036f)
 * 3. Lowercase
 * 4. Replace any non-alphanumeric / space chars with space
 * 5. Trim and collapse multiple spaces to single hyphen
 * 6. Collapse multiple hyphens to single hyphen
 * 7. Trim leading/trailing hyphens
 */
export function slugifyVietnamese(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Build the canonical SEO-friendly URL for a job.
 *
 * Uses stored slug if available, otherwise falls back to generating
 * one from the job title (useful for jobs created before this feature).
 */
export function buildJobUrl(job: { id: string; slug?: string | null; title: string }): string {
  const slug = job.slug ?? slugifyVietnamese(job.title);
  return `/jobs/${slug}--${job.id}`;
}

/**
 * Parse a job URL param of the form "slug--cuid".
 *
 * Uses lastIndexOf('--') so that slugs containing '--' are handled
 * correctly — only the final '--' is the separator between slug and ID.
 *
 * Returns null if:
 * - No '--' separator found (pure old-style ID URL)
 * - ID portion doesn't match Prisma cuid pattern
 * - Slug is empty
 */
export function parseJobUrlParam(param: string): { slug: string; id: string } | null {
  const lastSepIdx = param.lastIndexOf('--');
  if (lastSepIdx === -1) return null;
  const id = param.slice(lastSepIdx + 2);
  const slug = param.slice(0, lastSepIdx);
  if (!CUID_PATTERN.test(id) || !slug) return null;
  return { slug, id };
}
