import { describe, expect, it } from 'vitest';
import {
  isCvCompleted,
  mapUserToBrevoContact,
  splitVietnameseName,
  type BrevoMapperUser,
} from './brevo-contact.mapper';

function completeUser(overrides: Partial<BrevoMapperUser> = {}): BrevoMapperUser {
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
      expectedCulture: 'Open',
      careerGoals: [],
      workMode: null,
      linkedin: 'https://linkedin.com/in/a',
    },
    experiences: [{ id: 'exp1' }],
    educations: [{ id: 'edu1' }],
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
            expectedCulture: 'Open',
            careerGoals: [],
            workMode: null,
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

describe('isCvCompleted', () => {
  it('true khi đủ 5 mục', () => {
    expect(isCvCompleted(completeUser())).toBe(true);
  });

  it('false khi thiếu experiences', () => {
    expect(isCvCompleted(completeUser({ experiences: [] }))).toBe(false);
  });

  it('false khi thiếu educations', () => {
    expect(isCvCompleted(completeUser({ educations: [] }))).toBe(false);
  });

  it('false khi thiếu KSA', () => {
    expect(
      isCvCompleted(
        completeUser({
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
      isCvCompleted(
        completeUser({
          profile: { title: '' },
        }),
      ),
    ).toBe(false);
  });

  it('basic info chấp nhận location legacy string', () => {
    expect(
      isCvCompleted(
        completeUser({
          profile: {
            locations: [],
            location: 'HCMC',
          },
        }),
      ),
    ).toBe(true);
  });
});

describe('mapUserToBrevoContact', () => {
  it('map whitelist attributes + CV_COMPLETED', () => {
    const contact = mapUserToBrevoContact(completeUser());
    expect(contact).toEqual({
      email: 'a@example.com',
      attributes: {
        EXT_ID: 'user_1',
        FIRSTNAME: 'A',
        LASTNAME: 'Nguyen Van',
        PHONE: '0901234567',
        JOB_TITLE: 'Developer',
        LINKEDIN: 'https://linkedin.com/in/a',
        CV_COMPLETED: true,
      },
    });
  });

  it('null khi email không hợp lệ', () => {
    expect(mapUserToBrevoContact(completeUser({ email: 'not-an-email' }))).toBeNull();
    expect(mapUserToBrevoContact(completeUser({ email: '  ' }))).toBeNull();
  });

  it('dùng user.phone khi không có contactPhone', () => {
    const contact = mapUserToBrevoContact(
      completeUser({
        phone: '0911111111',
        profile: { contactPhone: null },
      }),
    );
    expect(contact?.attributes.PHONE).toBe('0911111111');
  });

  it('bỏ PHONE/JOB_TITLE/LINKEDIN khi trống', () => {
    const contact = mapUserToBrevoContact(
      completeUser({
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
  });

  it('một từ tên → chỉ FIRSTNAME', () => {
    const contact = mapUserToBrevoContact(
      completeUser({
        name: 'Madonna',
        profile: { fullName: 'Madonna' },
      }),
    );
    expect(contact?.attributes.FIRSTNAME).toBe('Madonna');
    expect(contact?.attributes.LASTNAME).toBeUndefined();
  });
});
