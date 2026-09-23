import {
  daysBetweenInclusive,
  formatYmd,
  getVnYmd,
  parseYmd,
} from '@/modules/system/admin-date-range';

export type CvActiveGranularity = 'daily' | 'weekly' | 'monthly';

export type CvActiveSnapshotPoint = {
  date: string;
  count: number;
};

/** Calendar DATE as UTC midnight for Prisma `@db.Date`. */
export function periodDateFromYmd(y: number, m: number, day: number): Date {
  return new Date(Date.UTC(y, m - 1, day));
}

export function periodDateToKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function vnPeriodDateToday(now: Date = new Date()): Date {
  const { y, m, day } = getVnYmd(now);
  return periodDateFromYmd(y, m, day);
}

export function vnPeriodDateKeyToday(now: Date = new Date()): string {
  const { y, m, day } = getVnYmd(now);
  return formatYmd(y, m, day);
}

/**
 * Inclusive day count → granularity.
 * &lt;42 daily · 42–180 weekly · &gt;180 monthly
 */
export function resolveCvActiveGranularity(dayCount: number): CvActiveGranularity {
  if (dayCount < 42) {
    return 'daily';
  }
  if (dayCount <= 180) {
    return 'weekly';
  }
  return 'monthly';
}

export function resolveCvActiveGranularityForRange(from: string, to: string): CvActiveGranularity {
  return resolveCvActiveGranularity(daysBetweenInclusive(from, to));
}

function mondayKeyOf(dateStr: string): string {
  const { y, m, day } = parseYmd(dateStr);
  const dow = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
  const isoDow = dow === 0 ? 7 : dow;
  const monday = new Date(Date.UTC(y, m - 1, day - (isoDow - 1)));
  return formatYmd(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate());
}

function monthKeyOf(dateStr: string): string {
  const { y, m } = parseYmd(dateStr);
  return formatYmd(y, m, 1);
}

/**
 * Stock metric: weekly/monthly lấy snapshot cuối trong bucket (không cộng dồn).
 * Daily trả đúng các điểm đã ghi (omit gap).
 */
export function aggregateCvActiveSnapshots(
  points: CvActiveSnapshotPoint[],
  granularity: CvActiveGranularity
): CvActiveSnapshotPoint[] {
  const sorted = [...points].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (granularity === 'daily') {
    return sorted;
  }

  const buckets = new Map<string, CvActiveSnapshotPoint>();
  for (const point of sorted) {
    const key = granularity === 'weekly' ? mondayKeyOf(point.date) : monthKeyOf(point.date);
    buckets.set(key, { date: key, count: point.count });
  }
  return [...buckets.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}
