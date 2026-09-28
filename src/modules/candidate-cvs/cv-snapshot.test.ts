import { describe, expect, it } from 'vitest';
import { buildCvSnapshot, parseCvSnapshot, type CvWithSections } from './cv-snapshot';

const baseCv = (): CvWithSections => ({
  id: 'cv1',
  userId: 'u1',
  name: 'CV Backend',
  nameNormalized: 'cv backend',
  avatar: 'https://cdn/avatar.png',
  headline: 'Headline',
  bio: '<p>Bio</p>',
  skills: ['ts'],
  cvUrl: 'https://cdn/cv.pdf',
  locations: ['ha-noi'],
  wardCodes: [],
  specificAddress: null,
  website: null,
  linkedin: null,
  github: null,
  contactEmail: 'a@x.test',
  contactPhone: '0900',
  fullName: 'Nguyễn A',
  title: 'Backend Dev',
  visibility: { bio: false, experience: true },
  knowledge: [],
  attitude: [],
  expectedSalaryMin: BigInt(15000000),
  expectedSalaryMax: null,
  salaryCurrency: 'VND',
  workMode: null,
  expectedCulture: null,
  careerGoals: [],
  gender: 'MALE',
  dayOfBirth: null,
  monthOfBirth: null,
  yearOfBirth: 1995,
  educationLevel: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
  experiences: [
    {
      id: 'e2', cvId: 'cv1', role: 'Junior', company: 'B', startDate: new Date('2019-01-01T00:00:00Z'),
      endDate: null, period: null, desc: null, achievements: [], order: 1,
      createdAt: new Date(), updatedAt: new Date(),
    },
    {
      id: 'e1', cvId: 'cv1', role: 'Senior', company: 'A', startDate: new Date('2022-01-01T00:00:00Z'),
      endDate: null, period: '2022 - nay', desc: 'desc', achievements: ['x'], order: 0,
      createdAt: new Date(), updatedAt: new Date(),
    },
  ],
  educations: [],
});

describe('buildCvSnapshot', () => {
  it('chụp đủ nội dung, lương dạng number, exp sắp theo order', () => {
    const snapshot = buildCvSnapshot({
      cv: baseCv(),
      account: { id: 'u1', name: 'A', email: 'a@x.test', phone: null, slug: 'a' },
      source: 'apply',
      capturedAt: new Date('2026-09-28T00:00:00Z'),
    });

    expect(snapshot).toMatchObject({
      version: 1,
      source: 'apply',
      capturedAt: '2026-09-28T00:00:00.000Z',
      cvId: 'cv1',
      cvName: 'CV Backend',
      account: { id: 'u1', email: 'a@x.test', slug: 'a' },
    });
    expect(snapshot.content.expectedSalaryMin).toBe(15000000);
    expect(snapshot.content.visibility).toEqual({ bio: false, experience: true });
    expect(snapshot.experiences.map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(snapshot.experiences[0]?.startDate).toBe('2022-01-01T00:00:00.000Z');
    expect(() => JSON.stringify(snapshot)).not.toThrow();
  });

  it('snapshot độc lập với CV nguồn sau khi sửa', () => {
    const cv = baseCv();
    const snapshot = buildCvSnapshot({
      cv,
      account: { id: 'u1', name: 'A', email: 'a@x.test', phone: null, slug: null },
      source: 'backfill',
    });
    cv.skills.push('go');
    cv.experiences[0]!.achievements.push('y');
    expect(snapshot.content.skills).toEqual(['ts']);
    expect(snapshot.experiences.find((e) => e.id === 'e2')?.achievements).toEqual([]);
  });

  it('parseCvSnapshot bỏ qua dữ liệu không đúng version', () => {
    expect(parseCvSnapshot(null)).toBeNull();
    expect(parseCvSnapshot({ version: 2 })).toBeNull();
    expect(parseCvSnapshot([])).toBeNull();
    expect(parseCvSnapshot({ version: 1, cvId: 'x' })).toMatchObject({ cvId: 'x' });
  });
});
