import { beforeEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({
  AWS_REGION: 'ap-southeast-1',
  AWS_S3_BUCKET: 'joywork-uploads',
  CDN_BASE_URL: undefined as string | undefined,
}));

vi.mock('@/config/env', () => ({
  config: env,
}));

describe('extractS3KeyFromPublicObjectUrl', () => {
  beforeEach(async () => {
    vi.resetModules();
    env.CDN_BASE_URL = undefined;
  });

  async function loadExtractor() {
    const mod = await import('./s3');
    return mod.extractS3KeyFromPublicObjectUrl;
  }

  it('trích key từ URL S3 trực tiếp', async () => {
    const extract = await loadExtractor();
    const key = extract(
      'https://joywork-uploads.s3.ap-southeast-1.amazonaws.com/users/u1/cv/file.pdf'
    );
    expect(key).toBe('users/u1/cv/file.pdf');
  });

  it('trích key từ URL CDN khi CDN_BASE_URL được cấu hình', async () => {
    env.CDN_BASE_URL = 'https://cdn.joywork.vn';
    const extract = await loadExtractor();
    const key = extract('https://cdn.joywork.vn/users/u1/cv/file.pdf');
    expect(key).toBe('users/u1/cv/file.pdf');
  });

  it('không nhận host CDN lạ', async () => {
    env.CDN_BASE_URL = 'https://cdn.joywork.vn';
    const extract = await loadExtractor();
    const key = extract('https://evil.example.com/users/u1/cv/file.pdf');
    expect(key).toBeNull();
  });

  it('trả null với URL không hợp lệ', async () => {
    const extract = await loadExtractor();
    expect(extract('not-a-url')).toBeNull();
  });
});
