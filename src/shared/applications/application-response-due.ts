export const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';
export const RESPONSE_DUE_AFTER_DAYS = 5;
export const RESPONSE_CLOSE_AFTER_REMINDER_DAYS = 3;
export const REMINDER_EMAIL_PREVIEW_LIMIT = 2;
export const RESPONSE_REMINDER_SUBJECT = '[Quan Trọng] Bạn có ứng tuyển cần phản hồi trên JOYWORK';

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfVnDay(date: Date): Date {
  const shifted = new Date(date.getTime() + VN_OFFSET_MS);
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - VN_OFFSET_MS,
  );
}

export function addCalendarDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Hồ sơ có appliedAt nhỏ hơn mốc này là đã đủ 5 ngày lịch VN. */
export function responseDueAppliedBefore(now: Date): Date {
  return addCalendarDays(startOfVnDay(now), -(RESPONSE_DUE_AFTER_DAYS - 1));
}

/** Mail nhắc gửi trước mốc này là đã đủ 3 ngày lịch VN. */
export function reminderSentBeforeForClose(now: Date): Date {
  return addCalendarDays(startOfVnDay(now), -(RESPONSE_CLOSE_AFTER_REMINDER_DAYS - 1));
}

export function isApplicationResponseDue(input: {
  status: string;
  companyRespondedAt: Date | null;
  appliedAt: Date;
  now: Date;
}): boolean {
  if (input.status !== 'RECEIVED' || input.companyRespondedAt) return false;
  return input.appliedAt < responseDueAppliedBefore(input.now);
}

export function isReadyToAutoClose(input: {
  status: string;
  companyRespondedAt: Date | null;
  responseReminderSentAt: Date | null;
  now: Date;
}): boolean {
  if (input.status !== 'RECEIVED' || input.companyRespondedAt || !input.responseReminderSentAt) {
    return false;
  }
  return input.responseReminderSentAt < reminderSentBeforeForClose(input.now);
}

export function responseCountPhrase(count: number): string {
  return count === 1 ? 'một' : String(count);
}

export function buildResponseReminderCopy(count: number, companyName: string): {
  heading: string;
  leadText: string;
  showSeeMore: boolean;
} {
  const phrase = responseCountPhrase(count);
  const company = companyName.trim() || 'doanh nghiệp';
  return {
    heading: `Bạn có ${phrase} ứng tuyển cần phản hồi`,
    leadText: `Hiện ${company} đang có ${phrase} hồ sơ ứng tuyển đã 5 ngày nhưng chưa được cập nhật trạng thái phản hồi trên JOYWORK. Có lẽ ứng viên đang rất mong chờ phản hồi từ bạn.`,
    showSeeMore: count > REMINDER_EMAIL_PREVIEW_LIMIT,
  };
}

export function selectReminderPreview<T>(items: T[]): T[] {
  return items.slice(0, REMINDER_EMAIL_PREVIEW_LIMIT);
}

export function formatVnDate(date: Date): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: VN_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}
