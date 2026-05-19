import { describe, expect, it } from 'vitest';
import { normalizeAiParsedCvPayload } from '../cv-import-normalize';
import { parsedCvSchema } from '../cv-imports.schema';

describe('normalizeAiParsedCvPayload', () => {
  it('chấp nhận output LLM hay trả sai kiểu (string number, gender case, URL thiếu protocol)', () => {
    const normalized = normalizeAiParsedCvPayload({
      basicInfo: {
        fullName: 'Nguyen Van A',
        gender: 'male',
        yearOfBirth: '1995',
      },
      contact: {
        contactEmail: 'a@example.com',
        linkedin: 'linkedin.com/in/nguyenvana',
      },
      skills: [{ name: 'TypeScript' }, 'React'],
      expectations: {
        expectedSalaryMin: '15,000,000',
        salaryCurrency: 'vnd',
      },
      experiences: [
        {
          position: 'Developer',
          organization: 'JoyWork',
          achievements: ['Ship feature X', ''],
        },
      ],
      confidence: '0.85',
    });

    const result = parsedCvSchema.safeParse(normalized);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.basicInfo.gender).toBe('MALE');
    expect(result.data.basicInfo.yearOfBirth).toBe(1995);
    expect(result.data.contact.linkedin).toMatch(/^https:\/\//);
    expect(result.data.skills).toEqual(['TypeScript', 'React']);
    expect(result.data.expectations.expectedSalaryMin).toBe(15000000);
    expect(result.data.expectations.salaryCurrency).toBe('VND');
    expect(result.data.experiences[0]?.role).toBe('Developer');
    expect(result.data.confidence).toBe(0.85);
  });

  it('bỏ qua email/URL không hợp lệ thay vì fail cả job', () => {
    const normalized = normalizeAiParsedCvPayload({
      contact: {
        contactEmail: 'not-an-email',
        website: 'not a url',
      },
    });

    const result = parsedCvSchema.safeParse(normalized);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.contact.contactEmail).toBeNull();
    expect(result.data.contact.website).toBeNull();
  });
});
