import { describe, expect, it } from 'vitest';
import {
  buildResponseReminderCopy,
  isApplicationResponseDue,
  isReadyToAutoClose,
  responseCountPhrase,
  selectReminderPreview,
} from './application-response-due';

const oct1MorningVn = new Date('2026-10-01T01:00:00.000Z');
const oct3MorningVn = new Date('2026-10-03T01:00:00.000Z');
const oct4MorningVn = new Date('2026-10-04T01:00:00.000Z');
const appliedSep26 = new Date('2026-09-26T16:30:00.000Z');
const appliedSep27 = new Date('2026-09-26T18:00:00.000Z');
const remindedOct1 = new Date('2026-10-01T01:00:00.000Z');

describe('application response due dates', () => {
  it('đủ 5 ngày lịch VN thì đến hạn, ngày ứng tuyển thứ 6 thì chưa', () => {
    expect(
      isApplicationResponseDue({
        status: 'RECEIVED',
        companyRespondedAt: null,
        appliedAt: appliedSep26,
        now: oct1MorningVn,
      }),
    ).toBe(true);
    expect(
      isApplicationResponseDue({
        status: 'RECEIVED',
        companyRespondedAt: null,
        appliedAt: appliedSep27,
        now: oct1MorningVn,
      }),
    ).toBe(false);
  });

  it('không đến hạn nếu doanh nghiệp đã đổi trạng thái hoặc trạng thái không còn RECEIVED', () => {
    expect(
      isApplicationResponseDue({
        status: 'RECEIVED',
        companyRespondedAt: oct1MorningVn,
        appliedAt: appliedSep26,
        now: oct4MorningVn,
      }),
    ).toBe(false);
    expect(
      isApplicationResponseDue({
        status: 'SUITABLE',
        companyRespondedAt: null,
        appliedAt: appliedSep26,
        now: oct4MorningVn,
      }),
    ).toBe(false);
  });

  it('đóng sau 3 ngày lịch kể từ mail nhắc, không đóng sớm và không đóng nếu đã phản hồi', () => {
    const base = {
      status: 'RECEIVED' as const,
      companyRespondedAt: null,
      responseReminderSentAt: remindedOct1,
    };
    expect(isReadyToAutoClose({ ...base, now: oct3MorningVn })).toBe(false);
    expect(isReadyToAutoClose({ ...base, now: oct4MorningVn })).toBe(true);
    expect(
      isReadyToAutoClose({
        ...base,
        companyRespondedAt: oct3MorningVn,
        now: oct4MorningVn,
      }),
    ).toBe(false);
    expect(isReadyToAutoClose({ ...base, responseReminderSentAt: null, now: oct4MorningVn })).toBe(false);
  });

  it('một hồ sơ viết “một”, từ 2 hồ sơ dùng chữ số và chỉ hiện Xem thêm khi hơn 2', () => {
    expect(responseCountPhrase(1)).toBe('một');
    expect(buildResponseReminderCopy(1, 'Bác Tôm').heading).toBe('Bạn có một ứng tuyển cần phản hồi');
    expect(buildResponseReminderCopy(1, 'Bác Tôm').leadText).toContain('Hiện Bác Tôm đang có một hồ sơ');
    expect(buildResponseReminderCopy(1, 'Bác Tôm').leadText).not.toContain('Quý Doanh Nghiệp');
    expect(buildResponseReminderCopy(1, 'Bác Tôm').leadText).toContain('đã 5 ngày');
    expect(buildResponseReminderCopy(1, 'Bác Tôm').showSeeMore).toBe(false);
    expect(buildResponseReminderCopy(2, 'Bác Tôm').heading).toBe('Bạn có 2 ứng tuyển cần phản hồi');
    expect(buildResponseReminderCopy(2, 'Bác Tôm').showSeeMore).toBe(false);
    expect(buildResponseReminderCopy(3, 'Bác Tôm').showSeeMore).toBe(true);
    expect(selectReminderPreview(['a', 'b', 'c'])).toEqual(['a', 'b']);
  });
});
