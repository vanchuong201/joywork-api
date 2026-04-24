/**
 * Shared utilities for Job URL slug generation, building, and parsing.
 * Uses the slugify package with Vietnamese locale.
 */
import { slugify } from './slug';

const CUID_PATTERN = /^[a-z][a-z0-9]{24}$/;

/**
 * Alias for backward compatibility with code that uses `slugifyVietnamese`.
 * @deprecated Use `slugify` from `@/shared/slug` instead.
 */
export const slugifyVietnamese = slugify;

/**
 * Build the canonical SEO-friendly URL for a job.
 *
 * Uses stored slug if available, otherwise falls back to generating
 * one from the job title (useful for jobs created before this feature).
 */
export function buildJobUrl(job: { id: string; slug?: string | null; title: string }): string {
  const slug = job.slug ?? slugify(job.title);
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
