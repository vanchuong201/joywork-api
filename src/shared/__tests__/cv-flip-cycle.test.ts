import { describe, expect, it } from 'vitest';
import {
  computeCvFlipExpiresAt,
  computeCvFlipPackageCycles,
  VN_OFFSET_MS,
} from '../cv-flip-cycle';

const vnInstant = (year: number, month: number, day: number, hour = 12): Date =>
  new Date(Date.UTC(year, month - 1, day, hour - 7, 0, 0));

describe('computeCvFlipPackageCycles', () => {
  it('không tính chu kỳ hiện tại vào số còn lại', () => {
    const start = vnInstant(2026, 3, 15);
    const expiresAt = computeCvFlipExpiresAt(1, 3, start);

    expect(computeCvFlipPackageCycles(1, 3, expiresAt, vnInstant(2026, 3, 20))).toMatchObject({
      expired: false,
      remainingCycles: 2,
      totalCycles: 3,
    });
    expect(computeCvFlipPackageCycles(1, 3, expiresAt, vnInstant(2026, 4, 10))).toMatchObject({
      expired: false,
      remainingCycles: 1,
      totalCycles: 3,
    });
    expect(computeCvFlipPackageCycles(1, 3, expiresAt, vnInstant(2026, 5, 10))).toMatchObject({
      expired: false,
      remainingCycles: 0,
      totalCycles: 3,
    });
  });

  it('hết hạn khi đã qua expiresAt', () => {
    const start = vnInstant(2026, 3, 15);
    const expiresAt = computeCvFlipExpiresAt(1, 3, start);

    expect(computeCvFlipPackageCycles(1, 3, expiresAt, expiresAt)).toMatchObject({
      expired: true,
      remainingCycles: 0,
      totalCycles: 3,
    });
    expect(
      computeCvFlipPackageCycles(1, 3, expiresAt, new Date(expiresAt.getTime() + 1)),
    ).toMatchObject({
      expired: true,
      remainingCycles: 0,
    });
  });

  it('gói 1 chu kỳ đang chạy thì còn lại 0/1', () => {
    const start = vnInstant(2026, 9, 10);
    const expiresAt = computeCvFlipExpiresAt(1, 1, start);

    expect(computeCvFlipPackageCycles(1, 1, expiresAt, vnInstant(2026, 9, 20))).toMatchObject({
      expired: false,
      remainingCycles: 0,
      totalCycles: 1,
    });
  });

  it('không có expiresAt thì coi chu kỳ hiện tại là chu kỳ 1', () => {
    expect(computeCvFlipPackageCycles(1, 4, null, vnInstant(2026, 9, 10))).toMatchObject({
      expired: false,
      remainingCycles: 3,
      totalCycles: 4,
    });
  });

  it('expiresAt khớp nửa đêm VN ngày bắt đầu chu kỳ N+1', () => {
    const expiresAt = computeCvFlipExpiresAt(1, 3, vnInstant(2026, 3, 15));
    expect(expiresAt.getTime()).toBe(Date.UTC(2026, 5, 1) - VN_OFFSET_MS);
  });
});
