import { describe, expect, it } from 'vitest';
import {
  daysBetweenInclusive,
  resolveAdminDateRange,
  vnDayStartUtc,
} from '@/modules/system/admin-date-range';

describe('resolveAdminDateRange', () => {
  // Wednesday 2026-09-16 10:00 VN = 2026-09-16 03:00 UTC
  const now = new Date('2026-09-16T03:00:00.000Z');

  it('resolves today in VN', () => {
    const r = resolveAdminDateRange({ preset: 'today', now });
    expect(r.from).toBe('2026-09-16');
    expect(r.to).toBe('2026-09-16');
    expect(r.keys).toEqual(['2026-09-16']);
    expect(r.start).toEqual(vnDayStartUtc(2026, 9, 16));
    expect(r.endExclusive).toEqual(vnDayStartUtc(2026, 9, 17));
  });

  it('resolves this_week as Monday..today ISO', () => {
    const r = resolveAdminDateRange({ preset: 'this_week', now });
    expect(r.from).toBe('2026-09-14'); // Monday
    expect(r.to).toBe('2026-09-16');
    expect(r.keys).toHaveLength(3);
  });

  it('resolves last_week as previous Mon..Sun', () => {
    const r = resolveAdminDateRange({ preset: 'last_week', now });
    expect(r.from).toBe('2026-09-07');
    expect(r.to).toBe('2026-09-13');
    expect(r.keys).toHaveLength(7);
  });

  it('resolves last30d inclusive', () => {
    const r = resolveAdminDateRange({ preset: 'last30d', now });
    expect(r.from).toBe('2026-08-18');
    expect(r.to).toBe('2026-09-16');
    expect(daysBetweenInclusive(r.from, r.to)).toBe(30);
    expect(r.keys).toHaveLength(30);
  });

  it('resolves custom range', () => {
    const r = resolveAdminDateRange({
      preset: 'custom',
      from: '2026-01-01',
      to: '2026-01-03',
      now,
    });
    expect(r.keys).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
  });
});
