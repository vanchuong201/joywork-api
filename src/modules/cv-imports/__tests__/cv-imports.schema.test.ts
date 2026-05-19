import { describe, expect, it } from 'vitest';
import {
  applyCvImportSchema,
  createCvImportSchema,
  parsedCvSchema,
} from '../cv-imports.schema';

describe('createCvImportSchema', () => {
  it('chấp nhận khi có sourceKey', () => {
    const parsed = createCvImportSchema.safeParse({ sourceKey: 'users/abc/cv/123.pdf' });
    expect(parsed.success).toBe(true);
  });

  it('chấp nhận khi có cvUrl', () => {
    const parsed = createCvImportSchema.safeParse({ cvUrl: 'https://bucket.s3.amazonaws.com/users/abc/cv/123.pdf' });
    expect(parsed.success).toBe(true);
  });

  it('từ chối khi thiếu cả sourceKey và cvUrl', () => {
    const parsed = createCvImportSchema.safeParse({});
    expect(parsed.success).toBe(false);
  });
});

describe('applyCvImportSchema', () => {
  it('phải có ít nhất một section', () => {
    const parsed = applyCvImportSchema.safeParse({ mode: 'fill_missing', sections: [] });
    expect(parsed.success).toBe(false);
  });

  it('chấp nhận mode hợp lệ', () => {
    const parsed = applyCvImportSchema.safeParse({ mode: 'overwrite', sections: ['basicInfo', 'skills'] });
    expect(parsed.success).toBe(true);
  });

  it('từ chối section không nằm trong danh sách', () => {
    const parsed = applyCvImportSchema.safeParse({ mode: 'fill_missing', sections: ['unknown'] });
    expect(parsed.success).toBe(false);
  });
});

describe('parsedCvSchema', () => {
  it('điền giá trị mặc định cho các mục thiếu', () => {
    const parsed = parsedCvSchema.parse({});
    expect(parsed.skills).toEqual([]);
    expect(parsed.experiences).toEqual([]);
    expect(parsed.educations).toEqual([]);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.basicInfo).toEqual({});
    expect(parsed.contact).toEqual({});
  });

  it('chuẩn hóa experience trả về object đầy đủ field', () => {
    const parsed = parsedCvSchema.parse({
      experiences: [
        {
          role: 'Senior Engineer',
          company: 'JoyWork',
          period: '2022 - hiện tại',
        },
      ],
    });

    expect(parsed.experiences).toHaveLength(1);
    expect(parsed.experiences[0]).toMatchObject({
      role: 'Senior Engineer',
      company: 'JoyWork',
      period: '2022 - hiện tại',
      startDate: null,
      endDate: null,
      desc: null,
      achievements: [],
    });
  });

  it('giới hạn số lượng skills', () => {
    const skills = Array.from({ length: 60 }, (_, idx) => `skill-${idx}`);
    const parsed = parsedCvSchema.safeParse({ skills });
    expect(parsed.success).toBe(false);
  });
});
