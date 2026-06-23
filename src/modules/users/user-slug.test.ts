import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findUniqueMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
}));

vi.mock('@/shared/database/prisma', () => ({
  prisma: {
    user: {
      findUnique: findUniqueMock,
    },
  },
}));

import { resolveUniqueUserSlug } from './user-profile.service';

describe('resolveUniqueUserSlug', () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    findUniqueMock.mockResolvedValue(null);
  });

  it('sinh slug từ name khi có tên', async () => {
    const slug = await resolveUniqueUserSlug({
      name: 'Nguyen Van A',
      email: 'a@example.com',
    });

    expect(slug).toBe('nguyen-van-a');
  });

  it('sinh slug từ email prefix khi không có name', async () => {
    const slug = await resolveUniqueUserSlug({
      email: 'john.doe@gmail.com',
    });

    expect(slug).toBe('john.doe');
  });

  it('thêm suffix khi slug đã tồn tại', async () => {
    findUniqueMock
      .mockResolvedValueOnce({ id: 'other-user' })
      .mockResolvedValueOnce(null);

    const slug = await resolveUniqueUserSlug({
      name: 'Nguyen Van A',
      email: 'a@example.com',
    });

    expect(slug).toBe('nguyen-van-a-1');
  });
});
