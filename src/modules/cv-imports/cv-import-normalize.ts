/**
 * Chuẩn hóa output thô từ LLM trước khi validate bằng Zod.
 * Giảm lỗi không ổn định khi model trả đúng nội dung nhưng sai kiểu (string thay vì number, enum sai case...).
 */

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function coerceString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
}

function truncateString(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, max).trimEnd();
}

function coerceStringArray(value: unknown, maxItems: number, maxItemLength?: number): string[] {
  if (!value) return [];
  const rawItems = Array.isArray(value) ? value : [value];
  const out: string[] = [];
  for (const item of rawItems) {
    let candidate: string | null = null;
    if (typeof item === 'string') {
      const trimmed = item.trim();
      if (trimmed) candidate = trimmed;
    } else if (item && typeof item === 'object' && !Array.isArray(item)) {
      const obj = item as Record<string, unknown>;
      candidate = coerceString(
        obj['name'] ?? obj['title'] ?? obj['label'] ?? obj['value'] ?? obj['text']
      );
    }
    if (candidate) {
      out.push(typeof maxItemLength === 'number' ? truncateString(candidate, maxItemLength) : candidate);
    }
    if (out.length >= maxItems) break;
  }
  return out;
}

function coerceInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === 'string') {
    const digits = value.replace(/[^\d]/g, '');
    if (!digits) return null;
    const n = Number.parseInt(digits, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function coerceFloat01(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value).replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function normalizeGender(value: unknown): 'MALE' | 'FEMALE' | 'OTHER' | null {
  const s = coerceString(value);
  if (!s) return null;
  const upper = s.toUpperCase();
  if (upper === 'MALE' || upper === 'NAM') return 'MALE';
  if (upper === 'FEMALE' || upper === 'NU' || upper === 'NỮ') return 'FEMALE';
  if (upper === 'OTHER' || upper === 'KHAC' || upper === 'KHÁC') return 'OTHER';
  return null;
}

function normalizeUrl(value: unknown): string | null {
  const s = coerceString(value);
  if (!s) return null;
  const withProtocol = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString();
    }
  } catch {
    // fall through
  }
  return null;
}

function normalizeEmail(value: unknown): string | null {
  const s = coerceString(value);
  if (!s) return null;
  const basic = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return basic.test(s) ? s : null;
}

function normalizeCurrency(value: unknown): 'VND' | 'USD' | null {
  const s = coerceString(value);
  if (!s) return null;
  const upper = s.toUpperCase();
  if (upper === 'VND' || upper.includes('DONG') || upper.includes('ĐỒNG')) return 'VND';
  if (upper === 'USD' || upper.includes('DOLLAR')) return 'USD';
  return null;
}

function normalizeExperienceItem(value: unknown): Record<string, unknown> | null {
  const obj = asRecord(value);
  if (!obj) return null;
  return {
    role: (() => {
      const value = coerceString(obj['role'] ?? obj['position'] ?? obj['title']);
      return value ? truncateString(value, 200) : null;
    })(),
    company: (() => {
      const value = coerceString(obj['company'] ?? obj['organization'] ?? obj['employer']);
      return value ? truncateString(value, 200) : null;
    })(),
    startDate: coerceString(obj['startDate'] ?? obj['start']),
    endDate: coerceString(obj['endDate'] ?? obj['end']),
    period: (() => {
      const value = coerceString(obj['period']);
      return value ? truncateString(value, 60) : null;
    })(),
    desc: (() => {
      const value = coerceString(obj['desc'] ?? obj['description'] ?? obj['summary']);
      return value ? truncateString(value, 2000) : null;
    })(),
    achievements: coerceStringArray(obj['achievements'] ?? obj['highlights'], 20, 500),
  };
}

function normalizeEducationItem(value: unknown): Record<string, unknown> | null {
  const obj = asRecord(value);
  if (!obj) return null;
  return {
    school: (() => {
      const value = coerceString(obj['school'] ?? obj['university'] ?? obj['institution']);
      return value ? truncateString(value, 200) : null;
    })(),
    degree: (() => {
      const value = coerceString(obj['degree'] ?? obj['major'] ?? obj['field']);
      return value ? truncateString(value, 200) : null;
    })(),
    startDate: coerceString(obj['startDate'] ?? obj['start']),
    endDate: coerceString(obj['endDate'] ?? obj['end']),
    period: (() => {
      const value = coerceString(obj['period']);
      return value ? truncateString(value, 60) : null;
    })(),
    gpa: (() => {
      const value = coerceString(obj['gpa'] ?? obj['grade']);
      return value ? truncateString(value, 40) : null;
    })(),
    honors: (() => {
      const value = coerceString(obj['honors'] ?? obj['awards']);
      return value ? truncateString(value, 200) : null;
    })(),
  };
}

function normalizeBasicInfo(value: unknown): Record<string, unknown> {
  const obj = asRecord(value) ?? {};
  const year = coerceInt(obj['yearOfBirth'] ?? obj['birthYear'] ?? obj['dob']);
  const currentYear = new Date().getFullYear();
  const yearOfBirth =
    year !== null && year >= 1900 && year <= currentYear ? year : null;

  const fullName = coerceString(obj['fullName'] ?? obj['name']);
  const title = coerceString(obj['title'] ?? obj['position']);
  const headline = coerceString(obj['headline'] ?? obj['tagline']);
  const bio = coerceString(obj['bio'] ?? obj['summary'] ?? obj['about']);

  return {
    fullName: fullName ? truncateString(fullName, 200) : null,
    title: title ? truncateString(title, 150) : null,
    headline: headline ? truncateString(headline, 150) : null,
    bio: bio ? truncateString(bio, 2000) : null,
    gender: normalizeGender(obj['gender']),
    yearOfBirth,
  };
}

function normalizeContact(value: unknown): Record<string, unknown> {
  const obj = asRecord(value) ?? {};
  return {
    contactEmail: normalizeEmail(obj['contactEmail'] ?? obj['email']),
    contactPhone: coerceString(obj['contactPhone'] ?? obj['phone'] ?? obj['mobile']),
    website: normalizeUrl(obj['website']),
    linkedin: normalizeUrl(obj['linkedin']),
    github: normalizeUrl(obj['github']),
  };
}

function normalizeExpectations(value: unknown): Record<string, unknown> {
  const obj = asRecord(value) ?? {};
  const min = coerceInt(obj['expectedSalaryMin'] ?? obj['salaryMin']);
  const max = coerceInt(obj['expectedSalaryMax'] ?? obj['salaryMax']);
  return {
    expectedSalaryMin: min !== null && min >= 0 ? min : null,
    expectedSalaryMax: max !== null && max >= 0 ? max : null,
    salaryCurrency: normalizeCurrency(obj['salaryCurrency'] ?? obj['currency']),
    workMode: coerceString(obj['workMode']),
  };
}

/** Chuẩn hóa payload JSON thô từ OpenAI thành shape gần với parsedCvSchema. */
export function normalizeAiParsedCvPayload(raw: unknown): Record<string, unknown> {
  const root = asRecord(raw) ?? {};

  const experiencesRaw = Array.isArray(root['experiences'])
    ? root['experiences']
    : Array.isArray(root['experience'])
      ? root['experience']
      : [];
  const educationsRaw = Array.isArray(root['educations'])
    ? root['educations']
    : Array.isArray(root['education'])
      ? root['education']
      : [];

  const experiences = experiencesRaw
    .map(normalizeExperienceItem)
    .filter((item): item is Record<string, unknown> => item !== null);
  const educations = educationsRaw
    .map(normalizeEducationItem)
    .filter((item): item is Record<string, unknown> => item !== null);

  return {
    basicInfo: normalizeBasicInfo(root['basicInfo']),
    contact: normalizeContact(root['contact']),
    // Truncate theo giới hạn parsedCvSchema để tránh job FAIL vì string dài từ Canva/OCR.
    skills: coerceStringArray(root['skills'], 40, 80),
    knowledge: coerceStringArray(root['knowledge'], 40, 200),
    attitude: coerceStringArray(root['attitude'], 40, 200),
    careerGoals: coerceStringArray(root['careerGoals'] ?? root['goals'], 20, 500),
    expectations: normalizeExpectations(root['expectations']),
    experiences,
    educations,
    warnings: coerceStringArray(root['warnings'], 20, 500),
    confidence: coerceFloat01(root['confidence']),
  };
}
