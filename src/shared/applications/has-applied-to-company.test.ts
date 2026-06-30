import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findFirstMock } = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
}));

vi.mock('@/shared/database/prisma', () => ({
  prisma: {
    application: {
      findFirst: findFirstMock,
    },
  },
}));

import { hasUserAppliedToCompany } from './has-applied-to-company';

describe('hasUserAppliedToCompany', () => {
  beforeEach(() => {
    findFirstMock.mockReset();
  });

  it('trả false khi companyId rỗng', async () => {
    const result = await hasUserAppliedToCompany({ userId: 'u1', companyId: '  ' });
    expect(result).toBe(false);
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it('trả true khi có application bất kỳ trạng thái', async () => {
    findFirstMock.mockResolvedValue({ id: 'app1' });
    const result = await hasUserAppliedToCompany({ userId: 'u1', companyId: 'c1' });
    expect(result).toBe(true);
    expect(findFirstMock).toHaveBeenCalledWith({
      where: {
        userId: 'u1',
        job: { companyId: 'c1' },
      },
      select: { id: true },
    });
  });

  it('trả false khi không có application', async () => {
    findFirstMock.mockResolvedValue(null);
    const result = await hasUserAppliedToCompany({ userId: 'u1', companyId: 'c1' });
    expect(result).toBe(false);
  });
});
