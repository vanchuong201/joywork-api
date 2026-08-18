import { describe, expect, it } from 'vitest';
import {
  isCvActivate,
  mapUserToBrevoContact,
  splitVietnameseName,
  type BrevoMapperUser,
} from './brevo-contact.mapper';

function readyUser(overrides: Partial<BrevoMapperUser> = {}): BrevoMapperUser {
  return {
    id: 'user_1',
    email: 'a@example.com',
    name: 'Nguyen Van A',
    phone: '0901234567',
    profile: {
      fullName: 'Nguyen Van A',
      title: 'Developer',
      bio: 'Bio here',
      contactEmail: 'a@example.com',
      contactPhone: '0901234567',
      locations: ['Ha Noi'],
      knowledge: ['JS'],
      skills: [],
      attitude: [],
      linkedin: 'https://linkedin.com/in/a',
    },
    experiences: [{ id: 'exp1' }],
    ...overrides,
    profile:
      overrides.profile === null
        ? null
        : {
            fullName: 'Nguyen Van A',
            title: 'Developer',
            bio: 'Bio here',
            contactEmail: 'a@example.com',
            contactPhone: '0901234567',
            locations: ['Ha Noi'],
            knowledge: ['JS'],
            skills: [],
            attitude: [],
            linkedin: 'https://linkedin.com/in/a',
            ...overrides.profile,
          },
  };
}

describe('splitVietnameseName', () => {
  it('token cuối → FIRSTNAME, phần còn lại → LASTNAME', () => {
    expect(splitVietnameseName('Nguyen Van A')).toEqual({
      firstName: 'A',
      lastName: 'Nguyen Van',
    });
  });

  it('một từ → chỉ FIRSTNAME', () => {
    expect(splitVietnameseName('Madonna')).toEqual({ firstName: 'Madonna' });
  });

  it('trim khoảng trắng thừa', () => {
    expect(splitVietnameseName('  Tran   Thi  B  ')).toEqual({
      firstName: 'B',
      lastName: 'Tran Thi',
    });
  });
});

describe('isCvActivate', () => {
  it('true khi đủ basic + KSA + experience (rule apply CV)', () => {
    expect(isCvActivate(readyUser())).toBe(true);
  });

  it('false khi thiếu experiences', () => {
    expect(isCvActivate(readyUser({ experiences: [] }))).toBe(false);
  });

  it('false khi thiếu KSA', () => {
    expect(
      isCvActivate(
        readyUser({
          profile: {
            knowledge: [],
            skills: [],
            attitude: [],
          },
        }),
      ),
    ).toBe(false);
  });

  it('false khi thiếu basic info (title)', () => {
    expect(
      isCvActivate(
        readyUser({
          profile: { title: '' },
        }),
      ),
    ).toBe(false);
  });

  it('false khi locations rỗng (cv-readiness không dùng legacy location string)', () => {
    expect(
      isCvActivate(
        readyUser({
          profile: {
            locations: [],
          },
        }),
      ),
    ).toBe(false);
  });

  it('true dù không có educations / expectations (không bắt buộc cho apply)', () => {
    expect(isCvActivate(readyUser())).toBe(true);
  });
});

describe('mapUserToBrevoContact', () => {
  it('map whitelist attributes + CV_ACTIVATE', () => {
    const contact = mapUserToBrevoContact(readyUser());
    expect(contact).toEqual({
      email: 'a@example.com',
      attributes: {
        EXT_ID: 'user_1',
        FIRSTNAME: 'A',
        LASTNAME: 'Nguyen Van',
        PHONE: '0901234567',
        JOB_TITLE: 'Developer',
        LINKEDIN: 'https://linkedin.com/in/a',
        CV_ACTIVATE: true,
      },
    });
  });

  it('CV_ACTIVATE false khi chưa sẵn sàng apply', () => {
    const contact = mapUserToBrevoContact(readyUser({ experiences: [] }));
    expect(contact?.attributes.CV_ACTIVATE).toBe(false);
  });

  it('null khi email không hợp lệ', () => {
    expect(mapUserToBrevoContact(readyUser({ email: 'not-an-email' }))).toBeNull();
    expect(mapUserToBrevoContact(readyUser({ email: '  ' }))).toBeNull();
  });

  it('dùng user.phone khi không có contactPhone', () => {
    const contact = mapUserToBrevoContact(
      readyUser({
        phone: '0911111111',
        profile: { contactPhone: null },
      }),
    );
    expect(contact?.attributes.PHONE).toBe('0911111111');
  });

  it('bỏ PHONE/JOB_TITLE/LINKEDIN khi trống', () => {
    const contact = mapUserToBrevoContact(
      readyUser({
        phone: null,
        profile: {
          contactPhone: null,
          title: null,
          linkedin: null,
        },
      }),
    );
    expect(contact?.attributes.PHONE).toBeUndefined();
    expect(contact?.attributes.JOB_TITLE).toBeUndefined();
    expect(contact?.attributes.LINKEDIN).toBeUndefined();
    expect(contact?.attributes.EXT_ID).toBe('user_1');
    expect(contact?.attributes.CV_ACTIVATE).toBe(false);
  });

  it('một từ tên → chỉ FIRSTNAME', () => {
    const contact = mapUserToBrevoContact(
      readyUser({
        name: 'Madonna',
        profile: { fullName: 'Madonna' },
      }),
    );
    expect(contact?.attributes.FIRSTNAME).toBe('Madonna');
    expect(contact?.attributes.LASTNAME).toBeUndefined();
  });
});
