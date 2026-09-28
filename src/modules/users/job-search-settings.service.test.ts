import { describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/database/prisma', () => ({ prisma: {} }));
vi.mock('@/shared/candidates/candidate-search-sync', () => ({ syncCandidateToEs: vi.fn() }));

import { resolveLegacySearchingJob, searchingJobToProfileFields } from './job-search-settings.service';

describe('job search toggle', () => {
  it('bật tìm việc đồng bộ status OPEN_TO_WORK và isPublic', () => {
    expect(searchingJobToProfileFields(true)).toEqual({
      isSearchingJob: true,
      isPublic: true,
      status: 'OPEN_TO_WORK',
    });
    expect(searchingJobToProfileFields(false)).toEqual({
      isSearchingJob: false,
      isPublic: false,
      status: 'NOT_AVAILABLE',
    });
  });

  it('payload cũ: ưu tiên isSearchingJob > isPublic > status', () => {
    expect(resolveLegacySearchingJob({ isSearchingJob: false, isPublic: true })).toBe(false);
    expect(resolveLegacySearchingJob({ isPublic: false, status: 'OPEN_TO_WORK' })).toBe(false);
    expect(resolveLegacySearchingJob({ status: 'NOT_AVAILABLE' })).toBe(false);
    expect(resolveLegacySearchingJob({ status: 'LOOKING' })).toBe(true);
    expect(resolveLegacySearchingJob({ status: null })).toBeUndefined();
    expect(resolveLegacySearchingJob({ allowCvFlip: true })).toBeUndefined();
  });
});
