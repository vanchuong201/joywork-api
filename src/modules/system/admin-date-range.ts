/** Asia/Ho_Chi_Minh fixed offset (no DST). */
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

export const ADMIN_DATE_PRESETS = [
  'today',
  'yesterday',
  'last7d',
  'last30d',
  'this_week',
  'last_week',
  'this_month',
  'last_month',
  'this_year',
  'last_year',
  'custom',
] as const;

export type AdminDatePreset = (typeof ADMIN_DATE_PRESETS)[number];

export const ADMIN_DATE_RANGE_MAX_DAYS = 366;

export interface ResolvedAdminDateRange {
  preset: AdminDatePreset;
  from: string;
  to: string;
  start: Date;
  endExclusive: Date;
  keys: string[];
}

type Ymd = { y: number; m: number; day: number };

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatYmd(y: number, m: number, day: number): string {
  return `${y}-${pad2(m)}-${pad2(day)}`;
}

export function parseYmd(value: string): Ymd {
  const parts = value.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(day)) {
    throw new Error(`Invalid YMD: ${value}`);
  }
  return { y, m, day };
}

/** Calendar Y-M-D in Vietnam for an absolute Instant. */
export function getVnYmd(d: Date): Ymd {
  const shifted = new Date(d.getTime() + VN_OFFSET_MS);
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/** Start of a Vietnam calendar day as UTC Instant (stored TIMESTAMP is UTC wall). */
export function vnDayStartUtc(y: number, m: number, day: number): Date {
  return new Date(Date.UTC(y, m - 1, day, 0, 0, 0, 0) - VN_OFFSET_MS);
}

export function addCalendarDays(y: number, m: number, day: number, delta: number): Ymd {
  const d = new Date(Date.UTC(y, m - 1, day + delta));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** Inclusive day count between YYYY-MM-DD bounds. */
export function daysBetweenInclusive(from: string, to: string): number {
  const a = parseYmd(from);
  const b = parseYmd(to);
  const ms =
    Date.UTC(b.y, b.m - 1, b.day) - Date.UTC(a.y, a.m - 1, a.day);
  return Math.floor(ms / (24 * 60 * 60 * 1000)) + 1;
}

function buildKeys(from: string, to: string): string[] {
  let cur = parseYmd(from);
  const keys: string[] = [];
  for (;;) {
    const key = formatYmd(cur.y, cur.m, cur.day);
    keys.push(key);
    if (key === to) {
      break;
    }
    cur = addCalendarDays(cur.y, cur.m, cur.day, 1);
    if (keys.length > ADMIN_DATE_RANGE_MAX_DAYS + 1) {
      throw new Error('DATE_RANGE_KEYS_OVERFLOW');
    }
  }
  return keys;
}

/** Monday of the ISO week containing the given VN calendar day. */
function mondayOfWeek(y: number, m: number, day: number): Ymd {
  const dow = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
  const isoDow = dow === 0 ? 7 : dow;
  return addCalendarDays(y, m, day, -(isoDow - 1));
}

export function resolveAdminDateRange(input: {
  preset?: AdminDatePreset;
  from?: string | undefined;
  to?: string | undefined;
  now?: Date;
}): ResolvedAdminDateRange {
  const now = input.now ?? new Date();
  const preset = input.preset ?? 'last30d';
  const today = getVnYmd(now);

  let fromYmd: string;
  let toYmd: string;

  switch (preset) {
    case 'today': {
      fromYmd = toYmd = formatYmd(today.y, today.m, today.day);
      break;
    }
    case 'yesterday': {
      const y = addCalendarDays(today.y, today.m, today.day, -1);
      fromYmd = toYmd = formatYmd(y.y, y.m, y.day);
      break;
    }
    case 'last7d': {
      const from = addCalendarDays(today.y, today.m, today.day, -6);
      fromYmd = formatYmd(from.y, from.m, from.day);
      toYmd = formatYmd(today.y, today.m, today.day);
      break;
    }
    case 'last30d': {
      const from = addCalendarDays(today.y, today.m, today.day, -29);
      fromYmd = formatYmd(from.y, from.m, from.day);
      toYmd = formatYmd(today.y, today.m, today.day);
      break;
    }
    case 'this_week': {
      const mon = mondayOfWeek(today.y, today.m, today.day);
      fromYmd = formatYmd(mon.y, mon.m, mon.day);
      toYmd = formatYmd(today.y, today.m, today.day);
      break;
    }
    case 'last_week': {
      const mon = mondayOfWeek(today.y, today.m, today.day);
      const lastMon = addCalendarDays(mon.y, mon.m, mon.day, -7);
      const lastSun = addCalendarDays(mon.y, mon.m, mon.day, -1);
      fromYmd = formatYmd(lastMon.y, lastMon.m, lastMon.day);
      toYmd = formatYmd(lastSun.y, lastSun.m, lastSun.day);
      break;
    }
    case 'this_month': {
      fromYmd = formatYmd(today.y, today.m, 1);
      toYmd = formatYmd(today.y, today.m, today.day);
      break;
    }
    case 'last_month': {
      const lastDayPrev = addCalendarDays(today.y, today.m, 1, -1);
      fromYmd = formatYmd(lastDayPrev.y, lastDayPrev.m, 1);
      toYmd = formatYmd(lastDayPrev.y, lastDayPrev.m, lastDayPrev.day);
      break;
    }
    case 'this_year': {
      fromYmd = formatYmd(today.y, 1, 1);
      toYmd = formatYmd(today.y, today.m, today.day);
      break;
    }
    case 'last_year': {
      fromYmd = formatYmd(today.y - 1, 1, 1);
      toYmd = formatYmd(today.y - 1, 12, 31);
      break;
    }
    case 'custom': {
      if (!input.from || !input.to) {
        throw new Error('CUSTOM_RANGE_REQUIRED');
      }
      fromYmd = input.from;
      toYmd = input.to;
      break;
    }
    default: {
      const _exhaustive: never = preset;
      throw new Error(`Unknown preset: ${_exhaustive}`);
    }
  }

  const fromParts = parseYmd(fromYmd);
  const toParts = parseYmd(toYmd);
  const nextAfterTo = addCalendarDays(toParts.y, toParts.m, toParts.day, 1);

  return {
    preset,
    from: fromYmd,
    to: toYmd,
    start: vnDayStartUtc(fromParts.y, fromParts.m, fromParts.day),
    endExclusive: vnDayStartUtc(nextAfterTo.y, nextAfterTo.m, nextAfterTo.day),
    keys: buildKeys(fromYmd, toYmd),
  };
}
