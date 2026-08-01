import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, esSearchMock, getEsClientMock } = vi.hoisted(() => ({
  prismaMock: {
    company: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
  esSearchMock: vi.fn(),
  getEsClientMock: vi.fn(),
}));

vi.mock('@/shared/database/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('@/config/env', () => ({
  config: {
    FRONTEND_ORIGIN: 'http://localhost:3000',
    ELASTICSEARCH_URL: 'http://localhost:9200',
    AWS_REGION: 'ap-southeast-1',
    AWS_ACCESS_KEY_ID: 'test',
    AWS_SECRET_ACCESS_KEY: 'test',
    S3_BUCKET: 'test-bucket',
  },
}));

vi.mock('@/shared/elasticsearch/client', () => ({
  getEsClient: getEsClientMock,
}));

vi.mock('@/shared/elasticsearch/sync', () => ({
  syncCompanyToEs: vi.fn(),
  deleteCompanyFromEs: vi.fn(),
}));

vi.mock('@/shared/services/email.service', () => ({
  emailService: {},
}));

vi.mock('@/shared/storage/s3', () => ({
  buildS3ObjectUrl: vi.fn(),
  getS3BucketName: vi.fn(() => 'test-bucket'),
  resolveReadableS3ObjectUrl: vi.fn(),
  s3Client: {},
}));

vi.mock('@/modules/posts/posts.service', () => ({
  PostsService: class {
    createPost = vi.fn();
  },
}));

import { CompaniesService } from './companies.service';
import { COMPANIES_INDEX } from '@/shared/elasticsearch/indices';

const service = new CompaniesService();

function buildCompany(overrides: Record<string, unknown> = {}) {
  return {
    id: 'company-1',
    name: 'JoyWork',
    legalName: 'JoyWork Co.',
    slug: 'joywork',
    tagline: null,
    description: null,
    logoUrl: null,
    coverUrl: null,
    website: null,
    location: '01',
    wardCodes: [],
    specificAddress: null,
    email: null,
    phone: null,
    industry: 'Công nghệ',
    size: '10-30',
    foundedYear: null,
    isVerified: false,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    badges: [{ type: 'GOOD_COMPANY' }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getEsClientMock.mockReturnValue({ search: esSearchMock });
  esSearchMock.mockResolvedValue({
    hits: {
      hits: [{ _source: { id: 'company-1' } }],
      total: { value: 1 },
    },
  });
  prismaMock.company.findMany.mockResolvedValue([buildCompany()]);
  prismaMock.company.count.mockResolvedValue(1);
});

describe('CompaniesService.searchCompanies badges', () => {
  describe('Elasticsearch path (q present)', () => {
    it('resolves badge company IDs and filters ES by id terms', async () => {
      // First call: resolve badge company IDs; second call: hydrate ES hits
      prismaMock.company.findMany
        .mockResolvedValueOnce([{ id: 'company-1' }, { id: 'company-2' }])
        .mockResolvedValueOnce([buildCompany()]);

      await service.searchCompanies({
        q: 'Joy',
        badges: 'GOOD_COMPANY',
        page: 1,
        limit: 20,
      });

      expect(prismaMock.company.findMany).toHaveBeenCalledWith({
        where: { badges: { some: { type: { in: ['GOOD_COMPANY'] } } } },
        select: { id: true },
      });

      const searchArg = esSearchMock.mock.calls[0]?.[0] as {
        index: string;
        query: { bool: { filter: object[] } };
      };
      expect(searchArg.index).toBe(COMPANIES_INDEX);
      expect(searchArg.query.bool.filter).toEqual(
        expect.arrayContaining([
          { terms: { id: ['company-1', 'company-2'] } },
        ]),
      );
    });

    it('returns empty when no companies have the requested badges', async () => {
      prismaMock.company.findMany.mockResolvedValueOnce([]);

      const result = await service.searchCompanies({
        q: 'Joy',
        badges: 'BASIC_COMMITMENT',
        page: 1,
        limit: 20,
      });

      expect(result.companies).toEqual([]);
      expect(result.pagination.total).toBe(0);
      expect(esSearchMock).not.toHaveBeenCalled();
    });
  });

  describe('Prisma path (no ES client)', () => {
    beforeEach(() => {
      getEsClientMock.mockReturnValue(null);
    });

    it('filters badges via Prisma where.badges.some', async () => {
      await service.searchCompanies({
        badges: 'GOOD_COMPANY,BASIC_COMMITMENT',
        page: 1,
        limit: 20,
      });

      expect(esSearchMock).not.toHaveBeenCalled();
      expect(prismaMock.company.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            badges: { some: { type: { in: ['GOOD_COMPANY', 'BASIC_COMMITMENT'] } } },
          }),
        }),
      );
      expect(prismaMock.company.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            badges: { some: { type: { in: ['GOOD_COMPANY', 'BASIC_COMMITMENT'] } } },
          }),
        }),
      );
    });
  });
});
