import { describe, expect, it } from 'vitest';
import { AppError } from '@/shared/errors/errorHandler';
import {
  buildDestinationPath,
  headingFromTitle,
  normalizeSeoPath,
  parseDestination,
  seoSlugFromPath,
  toJobSearchQuery,
} from '../seo-urls.destinations';

describe('normalizeSeoPath', () => {
  it('chuẩn hóa slug về chữ thường', () => {
    expect(normalizeSeoPath('/jobs/Viec-Lam-Marketing')).toBe('/jobs/viec-lam-marketing');
  });

  it('bỏ dấu gạch chéo cuối', () => {
    expect(normalizeSeoPath('/jobs/marketing/')).toBe('/jobs/marketing');
  });

  it('từ chối URL tuyệt đối', () => {
    expect(() => normalizeSeoPath('https://joywork.vn/jobs/marketing')).toThrow(AppError);
    expect(() => normalizeSeoPath('//joywork.vn/jobs/marketing')).toThrow(AppError);
  });

  it('từ chối slug có ký tự lạ hoặc query string', () => {
    expect(() => normalizeSeoPath('/jobs/c&b')).toThrow(/chữ thường/);
    expect(() => normalizeSeoPath('/jobs/marketing?page=2')).toThrow(/query string/);
  });

  it('từ chối slug trùng định dạng URL chi tiết việc làm', () => {
    expect(() => normalizeSeoPath('/jobs/marketing--cmsr40poq0008ml5l8dg4d5cy')).toThrow(/chi tiết việc làm/);
  });

  it('từ chối đường dẫn không phải /jobs/{slug}', () => {
    expect(() => normalizeSeoPath('/companies/abc')).toThrow(/\/jobs\/\{slug\}/);
    expect(() => normalizeSeoPath('/jobs')).toThrow(/\/jobs\/\{slug\}/);
  });
});

describe('parseDestination', () => {
  it('parse /jobs với bộ lọc hợp lệ', () => {
    const result = parseDestination('/jobs?q=Marketing&location=ha-noi');
    expect(result.type).toBe('JOB_SEARCH');
    expect(result.params).toEqual({ q: 'Marketing', location: 'ha-noi' });
    expect(result.originalPath).toBe('/jobs?location=ha-noi&q=Marketing');
  });

  it('cho ra cùng destinationKey khi chỉ khác thứ tự tham số', () => {
    const first = parseDestination('/jobs?q=Marketing&location=ha-noi');
    const second = parseDestination('/jobs?location=ha-noi&q=Marketing');
    expect(first.key).toBe(second.key);
  });

  it('coi q khác hoa thường là cùng intent', () => {
    expect(parseDestination('/jobs?q=Marketing').key).toBe(parseDestination('/jobs?q=marketing').key);
  });

  it('chuẩn hóa companyBadges theo thứ tự và loại trùng', () => {
    const result = parseDestination('/jobs?companyBadges=basic_commitment,GOOD_COMPANY,GOOD_COMPANY');
    expect(result.params['companyBadges']).toBe('BASIC_COMMITMENT,GOOD_COMPANY');
  });

  it('gộp khoảng trắng thừa trong q', () => {
    expect(parseDestination('/jobs?q=  Nhân   viên  kinh doanh ').params['q']).toBe('Nhân viên kinh doanh');
  });

  it('cảnh báo và bỏ tham số phân trang', () => {
    const result = parseDestination('/jobs?q=Marketing&page=3');
    expect(result.params['page']).toBeUndefined();
    expect(result.warnings.join(' ')).toMatch(/page/);
  });

  it('từ chối tham số ngoài allowlist', () => {
    expect(() => parseDestination('/jobs?utm_source=fb')).toThrow(/không được hỗ trợ/);
  });

  it('từ chối giá trị enum sai', () => {
    expect(() => parseDestination('/jobs?employmentType=FREELANCE')).toThrow(/employmentType/);
  });

  it('từ chối mã tỉnh không tồn tại', () => {
    expect(() => parseDestination('/jobs?location=atlantis')).toThrow(/tỉnh\/thành/);
  });

  it('từ chối đường đích chưa hỗ trợ', () => {
    expect(() => parseDestination('/companies?q=abc')).toThrow(/chưa được hỗ trợ/);
  });

  it('yêu cầu ít nhất một bộ lọc', () => {
    expect(() => parseDestination('/jobs')).toThrow(/ít nhất một bộ lọc/);
    expect(() => parseDestination('/jobs?q=')).toThrow(/ít nhất một bộ lọc/);
  });

  it('yêu cầu location khi lọc theo ward', () => {
    expect(() => parseDestination('/jobs?ward=abc')).toThrow(AppError);
  });

  it('từ chối khoảng lương ngược', () => {
    expect(() => parseDestination('/jobs?salaryMin=30000000&salaryMax=10000000')).toThrow(/salaryMin/);
  });
});

describe('buildDestinationPath', () => {
  it('sắp xếp tham số để đường dẫn ổn định', () => {
    expect(buildDestinationPath('JOB_SEARCH', { q: 'Marketing', location: 'ha-noi' })).toBe(
      '/jobs?location=ha-noi&q=Marketing',
    );
  });
});

describe('headingFromTitle', () => {
  it('bỏ hậu tố thương hiệu', () => {
    expect(headingFromTitle('Việc Làm Marketing Mới Nhất | JOYWORK')).toBe('Việc Làm Marketing Mới Nhất');
  });

  it('giữ nguyên khi không có hậu tố', () => {
    expect(headingFromTitle('Việc Làm Marketing')).toBe('Việc Làm Marketing');
  });
});

describe('seoSlugFromPath', () => {
  it('lấy slug từ seoPath', () => {
    expect(seoSlugFromPath('/jobs/marketing')).toBe('marketing');
  });
});

describe('toJobSearchQuery', () => {
  it('bổ sung phân trang và chỉ lấy tin đang hiển thị', () => {
    expect(toJobSearchQuery({ q: 'Marketing' })).toMatchObject({ q: 'Marketing', page: 1, isActive: true });
  });
});
