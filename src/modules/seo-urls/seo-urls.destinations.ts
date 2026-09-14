import type { SeoDestinationType } from '@prisma/client';
import { AppError } from '@/shared/errors/errorHandler';
import { PROVINCE_BY_CODE } from '@/shared/provinces';
import { WARD_BY_CODE, WARD_CODE_PATTERN } from '@/shared/wards';
import { VALID_BADGE_TYPES } from '@/shared/company-badges';
import { parseJobUrlParam } from '@/shared/job-slug';

export const SEO_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CUID_PATTERN = /^[a-z][a-z0-9]{24}$/;

/** Số job SSR trong trang đầu của landing, khớp limit UI danh sách việc làm. */
export const SEO_LANDING_PAGE_SIZE = 12;

export type DestinationParams = Record<string, string>;

export type ParsedDestination = {
  type: SeoDestinationType;
  /** Đường dẫn đã chuẩn hóa, dùng để hiển thị lại cho admin. */
  originalPath: string;
  params: DestinationParams;
  /** Khóa so trùng intent giữa các mapping. */
  key: string;
  /** Cảnh báo không chặn lưu, ví dụ tham số phân trang bị bỏ. */
  warnings: string[];
};

type ParamRule = {
  /** Chuẩn hóa giá trị; trả undefined để bỏ tham số rỗng. */
  normalize: (raw: string) => string | undefined;
};

/** Tham số điều hướng/hiển thị: chấp nhận nhưng không lưu vào bộ lọc đích. */
const IGNORED_JOB_SEARCH_PARAMS = new Set(['page', 'limit', 'view', 'featuredPage']);

function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function enumRule(field: string, allowed: readonly string[]): ParamRule {
  return {
    normalize: (raw) => {
      const value = raw.trim().toUpperCase();
      if (!value) return undefined;
      if (!allowed.includes(value)) {
        throw new AppError(`Giá trị ${field} không hợp lệ: ${raw.trim()}`, 400, 'INVALID_DESTINATION');
      }
      return value;
    },
  };
}

function positiveIntRule(field: string): ParamRule {
  return {
    normalize: (raw) => {
      const value = raw.trim();
      if (!value) return undefined;
      if (!/^\d+$/.test(value)) {
        throw new AppError(`Giá trị ${field} phải là số nguyên: ${value}`, 400, 'INVALID_DESTINATION');
      }
      return String(Number(value));
    },
  };
}

const JOB_SEARCH_PARAM_RULES: Record<string, ParamRule> = {
  q: {
    normalize: (raw) => collapseSpaces(raw) || undefined,
  },
  location: {
    normalize: (raw) => {
      const code = raw.trim().toLowerCase();
      if (!code) return undefined;
      if (!PROVINCE_BY_CODE.has(code)) {
        throw new AppError(`Mã tỉnh/thành không hợp lệ: ${code}`, 400, 'INVALID_DESTINATION');
      }
      return code;
    },
  },
  ward: {
    normalize: (raw) => {
      const code = raw.trim();
      if (!code) return undefined;
      if (!WARD_CODE_PATTERN.test(code) || !WARD_BY_CODE.has(code)) {
        throw new AppError(`Mã phường/xã không hợp lệ: ${code}`, 400, 'INVALID_DESTINATION');
      }
      return code;
    },
  },
  companyBadges: {
    normalize: (raw) => {
      const badges = new Set<string>();
      for (const part of raw.split(',')) {
        const badge = part.trim().toUpperCase();
        if (!badge) continue;
        if (!(VALID_BADGE_TYPES as string[]).includes(badge)) {
          throw new AppError(`Badge doanh nghiệp không hợp lệ: ${badge}`, 400, 'INVALID_DESTINATION');
        }
        badges.add(badge);
      }
      if (badges.size === 0) return undefined;
      return Array.from(badges).sort().join(',');
    },
  },
  companyId: {
    normalize: (raw) => {
      const value = raw.trim();
      if (!value) return undefined;
      if (!CUID_PATTERN.test(value)) {
        throw new AppError(`companyId không hợp lệ: ${value}`, 400, 'INVALID_DESTINATION');
      }
      return value;
    },
  },
  remote: {
    normalize: (raw) => {
      const value = raw.trim().toLowerCase();
      if (!value) return undefined;
      if (value !== 'true' && value !== 'false') {
        throw new AppError(`remote chỉ nhận true/false, nhận được: ${value}`, 400, 'INVALID_DESTINATION');
      }
      return value;
    },
  },
  employmentType: enumRule('employmentType', ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'REMOTE']),
  experienceLevel: enumRule('experienceLevel', [
    'NO_EXPERIENCE',
    'LT_1_YEAR',
    'Y1_2',
    'Y2_3',
    'Y3_5',
    'Y5_10',
    'GT_10',
  ]),
  jobLevel: enumRule('jobLevel', [
    'INTERN_STUDENT',
    'FRESH_GRAD',
    'EMPLOYEE',
    'SPECIALIST_TEAM_LEAD',
    'MANAGER_HEAD',
    'DIRECTOR',
    'EXECUTIVE',
  ]),
  educationLevel: enumRule('educationLevel', [
    'TRAINING_CENTER',
    'INTERMEDIATE',
    'COLLEGE',
    'BACHELOR',
    'MASTER',
    'PHD',
  ]),
  gender: enumRule('gender', ['MALE', 'FEMALE', 'OTHER']),
  worksOnSaturday: enumRule('worksOnSaturday', ['NO', 'YES', 'FLEXIBLE', 'FIXED']),
  salaryMin: positiveIntRule('salaryMin'),
  salaryMax: positiveIntRule('salaryMax'),
  salaryCurrency: enumRule('salaryCurrency', ['VND', 'USD']),
};

type DestinationHandler = {
  type: SeoDestinationType;
  pathname: string;
  label: string;
  paramRules: Record<string, ParamRule>;
  ignoredParams: Set<string>;
};

/**
 * Registry các loại trang đích được phép ánh xạ. Thêm renderer mới (ví dụ
 * `/companies`) bằng cách khai báo thêm handler ở đây và bổ sung renderer bên web.
 */
const DESTINATION_HANDLERS: DestinationHandler[] = [
  {
    type: 'JOB_SEARCH',
    pathname: '/jobs',
    label: 'Danh sách việc làm',
    paramRules: JOB_SEARCH_PARAM_RULES,
    ignoredParams: IGNORED_JOB_SEARCH_PARAMS,
  },
];

export function destinationLabel(type: SeoDestinationType): string {
  return DESTINATION_HANDLERS.find((handler) => handler.type === type)?.label ?? String(type);
}

export function supportedDestinationPaths(): string[] {
  return DESTINATION_HANDLERS.map((handler) => `${handler.pathname}?...`);
}

function splitRelativePath(raw: string, field: string): { pathname: string; search: string } {
  const value = raw.trim();
  if (!value) {
    throw new AppError(`${field} không được để trống`, 400, 'INVALID_PATH');
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//')) {
    throw new AppError(
      `${field} phải là đường dẫn tương đối, không chứa domain (ví dụ /jobs?q=Marketing)`,
      400,
      'INVALID_PATH',
    );
  }
  if (!value.startsWith('/')) {
    throw new AppError(`${field} phải bắt đầu bằng "/"`, 400, 'INVALID_PATH');
  }
  if (value.includes('#')) {
    throw new AppError(`${field} không được chứa dấu "#"`, 400, 'INVALID_PATH');
  }

  const queryIndex = value.indexOf('?');
  const pathname = queryIndex === -1 ? value : value.slice(0, queryIndex);
  const search = queryIndex === -1 ? '' : value.slice(queryIndex + 1);
  return { pathname: pathname.replace(/\/+$/, '') || '/', search };
}

/**
 * Chuẩn hóa SEO-friendly URL. Chỉ nhận `/jobs/{slug}` với slug chữ thường,
 * và loại các dạng trùng URL chi tiết việc làm (`{slug}--{cuid}` hoặc cuid thuần).
 */
export function normalizeSeoPath(raw: string): string {
  const { pathname, search } = splitRelativePath(raw, 'SEO URL');
  if (search) {
    throw new AppError('SEO URL không được chứa query string', 400, 'INVALID_PATH');
  }

  const segments = pathname.split('/').filter(Boolean);
  const rawSlug = segments[1];
  if (segments.length !== 2 || segments[0] !== 'jobs' || !rawSlug) {
    throw new AppError('SEO URL phải có dạng /jobs/{slug}', 400, 'INVALID_PATH');
  }

  const slug = rawSlug.toLowerCase();
  if (CUID_PATTERN.test(slug) || parseJobUrlParam(slug)) {
    throw new AppError('Slug trùng định dạng URL chi tiết việc làm', 400, 'RESERVED_SLUG');
  }
  if (!SEO_SLUG_PATTERN.test(slug)) {
    throw new AppError(`Slug chỉ được chứa chữ thường, số và dấu gạch ngang: ${rawSlug}`, 400, 'INVALID_SLUG');
  }

  return `/jobs/${slug}`;
}

export function seoSlugFromPath(seoPath: string): string {
  return seoPath.split('/').filter(Boolean)[1] ?? '';
}

function buildDestinationKey(type: SeoDestinationType, params: DestinationParams): string {
  const parts = Object.entries(params)
    .sort(([left], [right]) => left.localeCompare(right))
    // q so trùng theo dạng không phân biệt hoa thường để chặn landing cùng intent
    .map(([key, value]) => `${key}=${key === 'q' ? value.toLocaleLowerCase('vi') : value}`);
  return `${type}|${parts.join('&')}`;
}

export function buildDestinationPath(type: SeoDestinationType, params: DestinationParams): string {
  const handler = DESTINATION_HANDLERS.find((item) => item.type === type);
  if (!handler) {
    throw new AppError(`Loại trang đích chưa được hỗ trợ: ${type}`, 400, 'UNSUPPORTED_DESTINATION');
  }
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params).sort(([left], [right]) => left.localeCompare(right))) {
    search.set(key, value);
  }
  const query = search.toString();
  return query ? `${handler.pathname}?${query}` : handler.pathname;
}

/**
 * Parse URL gốc admin nhập thành destination chuẩn hóa. Runtime chỉ tin
 * `params` đã qua allowlist, không dùng lại chuỗi thô.
 */
export function parseDestination(raw: string): ParsedDestination {
  const { pathname, search } = splitRelativePath(raw, 'URL gốc');
  const handler = DESTINATION_HANDLERS.find((item) => item.pathname === pathname);
  if (!handler) {
    throw new AppError(
      `URL gốc chưa được hỗ trợ: ${pathname}. Hiện hỗ trợ ${supportedDestinationPaths().join(', ')}`,
      400,
      'UNSUPPORTED_DESTINATION',
    );
  }

  const warnings: string[] = [];
  const params: DestinationParams = {};
  const searchParams = new URLSearchParams(search);

  for (const [rawKey, rawValue] of searchParams.entries()) {
    const key = rawKey.trim();
    if (!key) continue;
    if (handler.ignoredParams.has(key)) {
      warnings.push(`Bỏ qua tham số điều hướng "${key}"`);
      continue;
    }
    const rule = handler.paramRules[key];
    if (!rule) {
      throw new AppError(`Tham số không được hỗ trợ: ${key}`, 400, 'INVALID_DESTINATION');
    }
    const value = rule.normalize(rawValue);
    if (value === undefined) continue;
    if (params[key] !== undefined && params[key] !== value) {
      throw new AppError(`Tham số ${key} bị khai báo nhiều lần với giá trị khác nhau`, 400, 'INVALID_DESTINATION');
    }
    params[key] = value;
  }

  if (Object.keys(params).length === 0) {
    throw new AppError(
      'URL gốc phải có ít nhất một bộ lọc (ví dụ /jobs?q=Marketing)',
      400,
      'INVALID_DESTINATION',
    );
  }

  if (params['ward'] && !params['location']) {
    throw new AppError('Bộ lọc phường/xã cần kèm tham số location', 400, 'INVALID_DESTINATION');
  }
  const salaryMin = params['salaryMin'];
  const salaryMax = params['salaryMax'];
  if (salaryMin && salaryMax && Number(salaryMin) > Number(salaryMax)) {
    throw new AppError('salaryMin không được lớn hơn salaryMax', 400, 'INVALID_DESTINATION');
  }

  return {
    type: handler.type,
    originalPath: buildDestinationPath(handler.type, params),
    params,
    key: buildDestinationKey(handler.type, params),
    warnings,
  };
}

/** Bỏ hậu tố thương hiệu để lấy H1 mặc định từ title admin đã kiểm duyệt. */
export function headingFromTitle(title: string): string {
  return collapseSpaces(title.replace(/\s*\|\s*JOYWORK\s*$/i, ''));
}

/** Tham số truyền vào JobsService.searchJobs cho destination JOB_SEARCH. */
export function toJobSearchQuery(params: DestinationParams): Record<string, string | number | boolean> {
  return {
    ...params,
    page: 1,
    limit: SEO_LANDING_PAGE_SIZE,
    isActive: true,
  };
}
