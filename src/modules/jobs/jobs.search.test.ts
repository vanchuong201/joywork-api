import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, esSearchMock, getEsClientMock } = vi.hoisted(() => ({
  prismaMock: {
    job: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    company: {
      findMany: vi.fn(),
    },
    application: {
      findUnique: vi.fn(),
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
  },
}));

vi.mock('@/shared/elasticsearch/client', () => ({
  getEsClient: getEsClientMock,
}));

vi.mock('@/shared/elasticsearch/sync', () => ({
  syncJobToEs: vi.fn(),
  deleteJobFromEs: vi.fn(),
}));

vi.mock('@/shared/services/email.service', () => ({
  emailService: {},
}));

vi.mock('@/shared/services/send-email-async', () => ({
  sendEmailInBackground: vi.fn(),
}));

vi.mock('@/shared/services/email-helper.service', () => ({
  getVerifiedEmailForUser: vi.fn(),
  getVerifiedEmailsForUsers: vi.fn(),
}));

vi.mock('@/shared/services/notification.service', () => ({
  notificationService: {},
}));

vi.mock('@/shared/services/embedding.service', () => ({
  generateAndStoreJobEmbedding: vi.fn(),
  generateEmbedding: vi.fn(),
}));

vi.mock('@/shared/candidates/cv-readiness', () => ({
  evaluateCandidateCvReadiness: vi.fn(),
}));

import { JobsService } from './jobs.service';
import { JOBS_INDEX } from '@/shared/elasticsearch/indices';

const service = new JobsService();

function buildJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-rest-1',
    companyId: 'company-1',
    title: 'Nhân viên kinh doanh',
    slug: 'nhan-vien-kinh-doanh',
    locations: ['01'],
    wardCodes: [],
    specificAddress: null,
    remote: false,
    currency: 'VND',
    employmentType: 'FULL_TIME',
    experienceLevel: 'Y1_2',
    tags: [],
    isActive: true,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    department: null,
    jobLevel: null,
    educationLevel: null,
    gender: null,
    generalInfo: '',
    mission: 'Bán hàng',
    tasks: 'Gặp khách',
    knowledge: '',
    skills: 'Kinh doanh',
    attitude: '',
    salaryMin: null,
    salaryMax: null,
    applicationDeadline: null,
    kpis: null,
    authority: null,
    relationships: null,
    careerPath: null,
    benefitsIncome: null,
    benefitsPerks: null,
    contact: null,
    workingTimeRanges: [{ dayFrom: 'MON', dayTo: 'FRI', timeStart: '09:00', timeEnd: '18:00' }],
    workingTimeNote: null,
    worksOnSaturday: 'NO',
    company: {
      id: 'company-1',
      name: 'JoyWork',
      legalName: null,
      slug: 'joywork',
      logoUrl: null,
      badges: [],
    },
    _count: { applications: 0 },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getEsClientMock.mockReturnValue({ search: esSearchMock });
  esSearchMock.mockResolvedValue({
    hits: {
      hits: [{ _source: { id: 'job-rest-1' } }],
      total: { value: 1 },
    },
  });
  prismaMock.job.findMany.mockResolvedValue([buildJob()]);
  prismaMock.job.count.mockResolvedValue(1);
  prismaMock.company.findMany.mockResolvedValue([{ id: 'company-1' }]);
  prismaMock.application.findUnique.mockResolvedValue(null);
});

describe('JobsService.searchJobs worksOnSaturday', () => {
  describe('Elasticsearch path (q present)', () => {
    it.each(['NO', 'FLEXIBLE', 'FIXED'] as const)(
      'applies worksOnSaturday=%s filter in ES query',
      async (worksOnSaturday) => {
        await service.searchJobs({
          q: 'Kinh doanh',
          worksOnSaturday,
          page: 1,
          limit: 12,
        });

        expect(esSearchMock).toHaveBeenCalledTimes(1);
        const searchArg = esSearchMock.mock.calls[0]?.[0] as {
          index: string;
          query: { bool: { filter: object[] } };
          track_total_hits: boolean;
        };
        expect(searchArg.index).toBe(JOBS_INDEX);
        expect(searchArg.track_total_hits).toBe(true);
        expect(searchArg.query.bool.filter).toEqual(
          expect.arrayContaining([
            { term: { isActive: true } },
            { term: { worksOnSaturday } },
          ]),
        );
      },
    );

    it('applies worksOnSaturday=YES as terms FIXED+FLEXIBLE in ES query', async () => {
      await service.searchJobs({
        q: 'Kinh doanh',
        worksOnSaturday: 'YES',
        page: 1,
        limit: 12,
      });

      const searchArg = esSearchMock.mock.calls[0]?.[0] as {
        query: { bool: { filter: object[] } };
      };
      expect(searchArg.query.bool.filter).toEqual(
        expect.arrayContaining([
          { terms: { worksOnSaturday: ['FIXED', 'FLEXIBLE'] } },
        ]),
      );
    });

    it('returns worksOnSaturday on hydrated ES results', async () => {
      const result = await service.searchJobs({
        q: 'Kinh doanh',
        worksOnSaturday: 'NO',
        page: 1,
        limit: 12,
      });

      expect(result.pagination.total).toBe(1);
      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0]?.worksOnSaturday).toBe('NO');
      expect(result.jobs[0]?.title).toBe('Nhân viên kinh doanh');
    });

    it('uses ES total after filtering instead of ignoring worksOnSaturday', async () => {
      esSearchMock.mockResolvedValue({
        hits: {
          hits: [{ _source: { id: 'job-rest-1' } }],
          total: { value: 36 },
        },
      });

      const result = await service.searchJobs({
        q: 'Kinh doanh',
        worksOnSaturday: 'NO',
        page: 1,
        limit: 12,
      });

      expect(result.pagination.total).toBe(36);
      expect(result.pagination.totalPages).toBe(3);
    });
  });

  describe('Prisma path (no ES client)', () => {
    beforeEach(() => {
      getEsClientMock.mockReturnValue(null);
    });

    it.each(['NO', 'FLEXIBLE', 'FIXED'] as const)(
      'filters worksOnSaturday=%s via Prisma where',
      async (worksOnSaturday) => {
        await service.searchJobs({
          q: 'Kinh doanh',
          worksOnSaturday,
          page: 1,
          limit: 12,
        });

        expect(esSearchMock).not.toHaveBeenCalled();
        expect(prismaMock.job.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              isActive: true,
              worksOnSaturday,
            }),
          }),
        );
        expect(prismaMock.job.count).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              worksOnSaturday,
            }),
          }),
        );
      },
    );

    it('filters worksOnSaturday=YES as FIXED+FLEXIBLE via Prisma where', async () => {
      await service.searchJobs({
        q: 'Kinh doanh',
        worksOnSaturday: 'YES',
        page: 1,
        limit: 12,
      });

      expect(prismaMock.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            worksOnSaturday: { in: ['FIXED', 'FLEXIBLE'] },
          }),
        }),
      );
    });
  });
});

describe('searchJobsSchema worksOnSaturday preprocess', () => {
  it('maps legacy WORK/REST and drops UNSPECIFIED', async () => {
    const { searchJobsSchema } = await import('./jobs.schema');
    expect(searchJobsSchema.parse({ worksOnSaturday: 'WORK' }).worksOnSaturday).toBe('YES');
    expect(searchJobsSchema.parse({ worksOnSaturday: 'REST' }).worksOnSaturday).toBe('NO');
    expect(searchJobsSchema.parse({ worksOnSaturday: 'UNSPECIFIED' }).worksOnSaturday).toBeUndefined();
    expect(searchJobsSchema.parse({ worksOnSaturday: 'YES' }).worksOnSaturday).toBe('YES');
    expect(searchJobsSchema.parse({ worksOnSaturday: 'FLEXIBLE' }).worksOnSaturday).toBe('FLEXIBLE');
  });
});

describe('JobsService.searchJobs companyBadges', () => {
  describe('Elasticsearch path (q present)', () => {
    it('resolves badge company IDs and filters ES by companyId terms', async () => {
      prismaMock.company.findMany.mockResolvedValue([{ id: 'company-1' }, { id: 'company-2' }]);

      await service.searchJobs({
        q: 'Kinh doanh',
        companyBadges: 'GOOD_COMPANY,BASIC_COMMITMENT',
        page: 1,
        limit: 12,
      });

      expect(prismaMock.company.findMany).toHaveBeenCalledWith({
        where: { badges: { some: { type: { in: ['GOOD_COMPANY', 'BASIC_COMMITMENT'] } } } },
        select: { id: true },
      });

      const searchArg = esSearchMock.mock.calls[0]?.[0] as {
        query: { bool: { filter: object[] } };
      };
      expect(searchArg.query.bool.filter).toEqual(
        expect.arrayContaining([
          { terms: { companyId: ['company-1', 'company-2'] } },
        ]),
      );
    });

    it('returns empty when no companies have the requested badges', async () => {
      prismaMock.company.findMany.mockResolvedValue([]);

      const result = await service.searchJobs({
        q: 'Kinh doanh',
        companyBadges: 'BASIC_COMMITMENT',
        page: 1,
        limit: 12,
      });

      expect(result.jobs).toEqual([]);
      expect(result.pagination.total).toBe(0);
      expect(esSearchMock).not.toHaveBeenCalled();
      expect(prismaMock.job.findMany).not.toHaveBeenCalled();
    });
  });

  describe('Prisma path (no ES client)', () => {
    beforeEach(() => {
      getEsClientMock.mockReturnValue(null);
    });

    it('filters by resolved companyId via Prisma where', async () => {
      prismaMock.company.findMany.mockResolvedValue([{ id: 'company-good' }]);

      await service.searchJobs({
        companyBadges: 'GOOD_COMPANY',
        page: 1,
        limit: 12,
      });

      expect(prismaMock.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            companyId: 'company-good',
          }),
        }),
      );
    });

    it('returns empty when companyId is outside badge company set', async () => {
      prismaMock.company.findMany.mockResolvedValue([{ id: 'company-good' }]);

      const result = await service.searchJobs({
        companyId: 'company-other',
        companyBadges: 'GOOD_COMPANY',
        page: 1,
        limit: 12,
      });

      expect(result.jobs).toEqual([]);
      expect(result.pagination.total).toBe(0);
      expect(prismaMock.job.findMany).not.toHaveBeenCalled();
    });
  });
});
