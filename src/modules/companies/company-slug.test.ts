import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    company: {
      findUnique: vi.fn(),
    },
    companySlugRedirect: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/shared/database/prisma', () => ({
  prisma: prismaMock,
}));

import {
  allocateUniqueCompanySlug,
  isHttpDerivedCompanySlug,
  resolveCompanyBySlug,
  slugFromCompanyName,
} from './company-slug';

describe('company slug repair', () => {
  beforeEach(() => {
    prismaMock.company.findUnique.mockReset();
    prismaMock.companySlugRedirect.findUnique.mockReset();
  });

  it('builds a slug from a vietnamese company name', () => {
    expect(slugFromCompanyName('Công ty Số Bie')).toBe('cong-ty-so-bie');
    expect(isHttpDerivedCompanySlug('https-sobie-vn-pages-tuyen-dung')).toBe(true);
    expect(isHttpDerivedCompanySlug('httpool')).toBe(true);
    expect(isHttpDerivedCompanySlug('acme')).toBe(false);
  });

  it('appends a numeric suffix when the generated slug is taken', async () => {
    const taken = new Set(['cong-ty-so-bie']);
    const slug = await allocateUniqueCompanySlug({
      name: 'Công ty Số Bie',
      companyId: 'cmp123abc',
      isTaken: async (value) => taken.has(value),
    });

    expect(slug).toBe('cong-ty-so-bie-2');
  });

  it('uses the legal name when the display name looks like a website', async () => {
    const slug = await allocateUniqueCompanySlug({
      name: 'https://sobie.vn/pages/tuyen-dung',
      legalName: 'Công ty Số Bie',
      companyId: 'cmp123abc',
      isTaken: async () => false,
    });

    expect(slug).toBe('cong-ty-so-bie');
  });

  it('falls back to the company id when every name still starts with http', async () => {
    const slug = await allocateUniqueCompanySlug({
      name: 'https://sobie.vn',
      legalName: 'http://example.com',
      companyId: 'AbC123xyz',
      isTaken: async () => false,
    });

    expect(slug).toBe('cong-ty-abc123');
  });

  it('resolves a previous slug through the redirect table', async () => {
    prismaMock.company.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'c1', slug: 'so-bie', name: 'Số Bie' });
    prismaMock.companySlugRedirect.findUnique.mockResolvedValue({ companyId: 'c1' });

    await expect(resolveCompanyBySlug('https-sobie-vn')).resolves.toEqual({
      id: 'c1',
      slug: 'so-bie',
      name: 'Số Bie',
    });
  });

  it('keeps the current slug without reading redirects', async () => {
    prismaMock.company.findUnique.mockResolvedValue({ id: 'c1', slug: 'so-bie', name: 'Số Bie' });

    await expect(resolveCompanyBySlug('so-bie')).resolves.toEqual({
      id: 'c1',
      slug: 'so-bie',
      name: 'Số Bie',
    });
    expect(prismaMock.companySlugRedirect.findUnique).not.toHaveBeenCalled();
  });
});
