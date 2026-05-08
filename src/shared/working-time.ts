export const WORKING_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
export type WorkingDay = (typeof WORKING_DAYS)[number];

export const WORKING_DAY_INDEX: Record<WorkingDay, number> = {
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
  SUN: 7,
};

export const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface WorkingTimeRange {
  dayFrom: WorkingDay;
  dayTo: WorkingDay;
  timeStart: string;
  timeEnd: string;
}

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

export function compareTime(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function rangeIncludesDay(range: WorkingTimeRange, day: WorkingDay): boolean {
  const fromIdx = WORKING_DAY_INDEX[range.dayFrom];
  const toIdx = WORKING_DAY_INDEX[range.dayTo];
  const dayIdx = WORKING_DAY_INDEX[day];
  if (fromIdx <= toIdx) {
    return dayIdx >= fromIdx && dayIdx <= toIdx;
  }
  return dayIdx >= fromIdx || dayIdx <= toIdx;
}

export function computeWorksOnSaturday(ranges?: WorkingTimeRange[] | null): boolean | null {
  if (!Array.isArray(ranges) || ranges.length === 0) return null;
  return ranges.some((range) => rangeIncludesDay(range, 'SAT'));
}
