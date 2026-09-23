import { describe, expect, it } from 'vitest';
import {
  aggregateCvActiveSnapshots,
  resolveCvActiveGranularity,
} from '@/modules/system/cv-active-snapshot';

describe('resolveCvActiveGranularity', () => {
  it('uses daily below 42 days', () => {
    expect(resolveCvActiveGranularity(1)).toBe('daily');
    expect(resolveCvActiveGranularity(41)).toBe('daily');
  });

  it('uses weekly from 42 through 180', () => {
    expect(resolveCvActiveGranularity(42)).toBe('weekly');
    expect(resolveCvActiveGranularity(180)).toBe('weekly');
  });

  it('uses monthly above 180', () => {
    expect(resolveCvActiveGranularity(181)).toBe('monthly');
    expect(resolveCvActiveGranularity(366)).toBe('monthly');
  });
});

describe('aggregateCvActiveSnapshots', () => {
  const points = [
    { date: '2026-09-14', count: 10 }, // Mon
    { date: '2026-09-15', count: 12 },
    { date: '2026-09-16', count: 11 },
    { date: '2026-09-21', count: 20 }, // Mon next week
    { date: '2026-09-22', count: 22 },
    { date: '2026-10-01', count: 30 },
    { date: '2026-10-15', count: 35 },
  ];

  it('keeps daily points sorted', () => {
    expect(aggregateCvActiveSnapshots(points, 'daily')).toEqual(points);
  });

  it('takes last snapshot per ISO week', () => {
    expect(aggregateCvActiveSnapshots(points, 'weekly')).toEqual([
      { date: '2026-09-14', count: 11 },
      { date: '2026-09-21', count: 22 },
      { date: '2026-09-28', count: 30 },
      { date: '2026-10-12', count: 35 },
    ]);
  });

  it('takes last snapshot per month', () => {
    expect(aggregateCvActiveSnapshots(points, 'monthly')).toEqual([
      { date: '2026-09-01', count: 22 },
      { date: '2026-10-01', count: 35 },
    ]);
  });
});
