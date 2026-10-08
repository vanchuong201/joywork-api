import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    company: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/shared/database/prisma', () => ({
  prisma: prismaMock,
}));

import { AppError } from '@/shared/errors/errorHandler';
import {
  assertCompanyManageable,
  assertCompanyManageableById,
  assertHideReason,
  hideCompanyData,
  publicCompanyWhere,
  restoreCompanyData,
} from './company-visibility';

describe('company visibility', () => {
  beforeEach(() => {
    prismaMock.company.findUnique.mockReset();
  });

  it('public filter keeps only ACTIVE companies', () => {
    expect(publicCompanyWhere()).toEqual({ visibilityStatus: 'ACTIVE' });
  });

  it('allows members to operate an ACTIVE company', () => {
    expect(() => assertCompanyManageable({ visibilityStatus: 'ACTIVE' })).not.toThrow();
  });

  it('blocks members of a HIDDEN company', () => {
    expect(() => assertCompanyManageable({ visibilityStatus: 'HIDDEN' })).toThrow(AppError);
    try {
      assertCompanyManageable({ visibilityStatus: 'HIDDEN' });
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).statusCode).toBe(403);
      expect((error as AppError).code).toBe('COMPANY_HIDDEN');
    }
  });

  it('requires a hide reason between 1 and 500 characters', () => {
    expect(assertHideReason('  spam  ')).toBe('spam');
    expect(() => assertHideReason('   ')).toThrow(AppError);
    expect(() => assertHideReason('x'.repeat(501))).toThrow(AppError);
  });

  it('builds hide and restore writes', () => {
    const hiddenAt = new Date('2026-10-08T00:00:00.000Z');
    expect(hideCompanyData('admin-1', 'trùng dữ liệu', hiddenAt)).toEqual({
      visibilityStatus: 'HIDDEN',
      hiddenAt,
      hiddenById: 'admin-1',
      hiddenReason: 'trùng dữ liệu',
    });
    expect(restoreCompanyData()).toEqual({
      visibilityStatus: 'ACTIVE',
      hiddenAt: null,
      hiddenById: null,
      hiddenReason: null,
    });
  });

  it('loads a company before the member gate', async () => {
    prismaMock.company.findUnique.mockResolvedValue({ visibilityStatus: 'HIDDEN' });
    await expect(assertCompanyManageableById('company-1')).rejects.toMatchObject({
      statusCode: 403,
      code: 'COMPANY_HIDDEN',
    });

    prismaMock.company.findUnique.mockResolvedValue(null);
    await expect(assertCompanyManageableById('missing')).rejects.toMatchObject({
      statusCode: 404,
      code: 'COMPANY_NOT_FOUND',
    });
  });
});
