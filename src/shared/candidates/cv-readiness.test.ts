import { describe, expect, it } from 'vitest';
import { buildCvReadyUserWhere, evaluateCandidateCvReadiness } from './cv-readiness';

describe('cv-readiness', () => {
  it('đánh dấu ready khi đủ 3 nhóm với fallback từ user (không cần avatar)', () => {
    const readiness = evaluateCandidateCvReadiness({
      name: 'Ứng viên A',
      email: 'candidate@example.com',
      phone: '0900000000',
      avatar: null,
      profile: {
        avatar: null,
        fullName: null,
        contactEmail: null,
        contactPhone: null,
        title: 'Backend Developer',
        bio: 'Có 3 năm kinh nghiệm',
        locations: ['ha-noi'],
        knowledge: [],
        skills: ['Node.js'],
        attitude: [],
      },
      experiencesCount: 1,
    });

    expect(readiness.isReady).toBe(true);
    expect(readiness.missingSections).toEqual([]);
  });

  it('báo thiếu đúng nhóm khi thiếu thông tin cơ bản và kinh nghiệm', () => {
    const readiness = evaluateCandidateCvReadiness({
      name: null,
      email: 'candidate@example.com',
      phone: '0900000000',
      avatar: null,
      profile: {
        fullName: null,
        title: null,
        bio: null,
        locations: ['ha-noi'],
        knowledge: ['React'],
        skills: [],
        attitude: [],
      },
      experiencesCount: 0,
    });

    expect(readiness.isReady).toBe(false);
    expect(readiness.missingSections).toEqual(['Thông tin cơ bản', 'Kinh nghiệm làm việc']);
  });

  it('coi KSA trống toàn whitespace là chưa đạt', () => {
    const readiness = evaluateCandidateCvReadiness({
      name: 'Ứng viên C',
      email: 'candidate@example.com',
      phone: '0900000000',
      avatar: null,
      profile: {
        fullName: 'Ứng viên C',
        contactEmail: 'candidate@example.com',
        contactPhone: '0900000000',
        title: 'QA Engineer',
        bio: 'Testing profile',
        locations: ['ha-noi'],
        knowledge: ['   '],
        skills: [''],
        attitude: [],
      },
      experiencesCount: 2,
    });

    expect(readiness.isReady).toBe(false);
    expect(readiness.missingSections).toEqual(['Năng lực (KSA)']);
  });

  it('build where có điều kiện kinh nghiệm và KSA, không bắt buộc avatar', () => {
    const where = buildCvReadyUserWhere();
    const readinessAndConditions = (where.AND ?? []) as Array<Record<string, unknown>>;

    expect(readinessAndConditions).toContainEqual({ experiences: { some: {} } });
    expect(readinessAndConditions).toContainEqual({
      OR: [
        { profile: { is: { knowledge: { isEmpty: false } } } },
        { profile: { is: { skills: { isEmpty: false } } } },
        { profile: { is: { attitude: { isEmpty: false } } } },
      ],
    });

    const serialized = JSON.stringify(readinessAndConditions);
    expect(serialized).not.toContain('"avatar"');
  });
});
