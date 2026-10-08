import { describe, expect, it } from 'vitest';
import { companySitemapWhere, jobSitemapWhere } from './sitemap.service';

describe('sitemap filters', () => {
  it('indexes a company with an active job and skips http slugs, without a deadline filter', () => {
    const where = companySitemapWhere();
    expect(where).toEqual({
      visibilityStatus: 'ACTIVE',
      NOT: { slug: { startsWith: 'http', mode: 'insensitive' } },
      jobs: { some: { isActive: true } },
    });
    expect(JSON.stringify(where)).not.toContain('applicationDeadline');
  });

  it('indexes only active jobs that are still open', () => {
    const now = new Date('2026-10-07T00:00:00.000Z');
    expect(jobSitemapWhere(now)).toEqual({
      isActive: true,
      company: { visibilityStatus: 'ACTIVE' },
      OR: [{ applicationDeadline: null }, { applicationDeadline: { gt: now } }],
    });
  });
});
