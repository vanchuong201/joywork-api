import { Prisma } from '@prisma/client';

export const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
export const DEFAULT_CYCLE_START_DAY = 1;
export const DEFAULT_CYCLE_COUNT = 1;
export const DEFAULT_MONTHLY_TOTAL_LIMIT = 500;

export type CvFlipLimitMetadata = {
  monthlyTotalLimit: number;
  cycleStartDay: number;
  cycleCount: number;
};

export const parsePositiveNumber = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value <= 0) return null;
  return Math.floor(value);
};

export const clampCycleStartDay = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_CYCLE_START_DAY;
  const day = Math.floor(value);
  if (day < 1) return DEFAULT_CYCLE_START_DAY;
  return Math.min(31, day);
};

export const clampCycleCount = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_CYCLE_COUNT;
  const count = Math.floor(value);
  return count < 1 ? DEFAULT_CYCLE_COUNT : count;
};

export const lastDayOfMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

export const clampDayInMonth = (year: number, month: number, day: number): number =>
  Math.min(day, lastDayOfMonth(year, month));

export const vietnamYmd = (date: Date): { year: number; month: number; day: number } => {
  const vn = new Date(date.getTime() + VN_OFFSET_MS);
  return {
    year: vn.getUTCFullYear(),
    month: vn.getUTCMonth() + 1,
    day: vn.getUTCDate(),
  };
};

export const shiftMonth = (year: number, month: number, delta: number): { year: number; month: number } => {
  const index = month - 1 + delta;
  const nextYear = year + Math.floor(index / 12);
  const nextMonth = ((index % 12) + 12) % 12 + 1;
  return { year: nextYear, month: nextMonth };
};

export const formatYmd = (year: number, month: number, day: number): string =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export const getCyclePeriodStart = (
  cycleStartDay: number,
  date = new Date(),
): { year: number; month: number } => {
  const startDay = clampCycleStartDay(cycleStartDay);
  const today = vietnamYmd(date);
  const thisMonthStartDay = clampDayInMonth(today.year, today.month, startDay);
  return today.day >= thisMonthStartDay
    ? { year: today.year, month: today.month }
    : shiftMonth(today.year, today.month, -1);
};

export const getCyclePeriod = (
  cycleStartDay: number,
  date = new Date(),
): { month: number; year: number; expiresOn: string } => {
  const startDay = clampCycleStartDay(cycleStartDay);
  const periodStart = getCyclePeriodStart(startDay, date);
  const nextStart = shiftMonth(periodStart.year, periodStart.month, 1);
  const nextStartDay = clampDayInMonth(nextStart.year, nextStart.month, startDay);
  const expiry = new Date(Date.UTC(nextStart.year, nextStart.month - 1, nextStartDay));
  expiry.setUTCDate(expiry.getUTCDate() - 1);

  return {
    month: periodStart.month,
    year: periodStart.year,
    expiresOn: formatYmd(expiry.getUTCFullYear(), expiry.getUTCMonth() + 1, expiry.getUTCDate()),
  };
};

/** Instant gói hết hạn: nửa đêm VN ngày bắt đầu chu kỳ thứ N+1. */
export const computeCvFlipExpiresAt = (
  cycleStartDay: number,
  cycleCount: number,
  date = new Date(),
): Date => {
  const startDay = clampCycleStartDay(cycleStartDay);
  const count = clampCycleCount(cycleCount);
  const periodStart = getCyclePeriodStart(startDay, date);
  const afterLast = shiftMonth(periodStart.year, periodStart.month, count);
  const afterLastDay = clampDayInMonth(afterLast.year, afterLast.month, startDay);
  return new Date(Date.UTC(afterLast.year, afterLast.month - 1, afterLastDay) - VN_OFFSET_MS);
};

export const parseCvFlipLimitMetadata = (
  metadata: Prisma.JsonValue | null | undefined,
): CvFlipLimitMetadata => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {
      monthlyTotalLimit: DEFAULT_MONTHLY_TOTAL_LIMIT,
      cycleStartDay: DEFAULT_CYCLE_START_DAY,
      cycleCount: DEFAULT_CYCLE_COUNT,
    };
  }

  const record = metadata as Record<string, unknown>;
  return {
    monthlyTotalLimit: parsePositiveNumber(record['monthlyTotalLimit']) ?? DEFAULT_MONTHLY_TOTAL_LIMIT,
    cycleStartDay: clampCycleStartDay(record['cycleStartDay']),
    cycleCount: clampCycleCount(record['cycleCount']),
  };
};
