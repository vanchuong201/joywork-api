/**
 * Shared slug utilities using the slugify package.
 * Uses locale 'vi' for proper Vietnamese diacritics handling.
 *
 * Usage:
 *   import { slugify } from '@/shared/slug';
 *   const s = slugify('Tiêu đề công việc');
 *
 * Note: For job slugs, use `buildJobUrl` from `@/shared/job-slug` instead,
 * which handles the slug--id URL format separately.
 */
import slugifyLib from 'slugify';

export const slugify = (text: string): string => {
  return slugifyLib(text, {
    locale: 'vi',
    lower: true,
    strict: false,
    trim: true,
  });
};

/**
 * Alias for backward compatibility with code that uses `slugifyVietnamese`.
 * @deprecated Use `slugify` instead.
 */
export const slugifyVietnamese = slugify;
