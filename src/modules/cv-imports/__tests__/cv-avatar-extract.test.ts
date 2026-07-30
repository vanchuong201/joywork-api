import sharp from 'sharp';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isPlaceholderCandidateAvatarUrl } from '@/shared/candidates/default-avatar';
import type { RawCandidate } from '../avatar/types';

const mockExtractPdfCandidates = vi.fn<Promise<RawCandidate[]>, [Buffer]>();
const mockExtractDocxCandidates = vi.fn<Promise<RawCandidate[]>, [Buffer]>();

vi.mock('../avatar/candidate-extractor-pdf', () => ({
  extractPdfCandidates: (buffer: Buffer) => mockExtractPdfCandidates(buffer),
}));

vi.mock('../avatar/candidate-extractor-docx', () => ({
  extractDocxCandidates: (buffer: Buffer) => mockExtractDocxCandidates(buffer),
}));

import { extractAvatar } from '../avatar';

async function createSolidPng(params: {
  width: number;
  height: number;
  r: number;
  g: number;
  b: number;
  alpha?: number;
}): Promise<Buffer> {
  const { width, height, r, g, b, alpha = 1 } = params;
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r, g, b, alpha },
    },
  })
    .png()
    .toBuffer();
}

describe('extractAvatar', () => {
  beforeEach(() => {
    mockExtractPdfCandidates.mockReset();
    mockExtractDocxCandidates.mockReset();
  });

  it('trả unsupported_file khi magic bytes không hợp lệ', async () => {
    const invalidPdf = Buffer.from('not-a-pdf');
    const result = await extractAvatar({
      buffer: invalidPdf,
      mime: 'application/pdf',
    });
    expect(result.status).toBe('unsupported_file');
    if (result.status === 'unsupported_file') {
      expect(result.code).toBe('invalid_magic_bytes');
    }
  });

  it('trả not_found/no_embedded_images khi PDF không có ảnh nhúng', async () => {
    mockExtractPdfCandidates.mockResolvedValueOnce([]);
    const result = await extractAvatar({
      buffer: Buffer.from('%PDF-1.7\n'),
      mime: 'application/pdf',
    });
    expect(result.status).toBe('not_found');
    if (result.status === 'not_found') {
      expect(result.code).toBe('no_embedded_images');
    }
  });

  it('chọn được avatar khi có candidate hợp lệ', async () => {
    const portrait = await createSolidPng({
      width: 420,
      height: 560,
      r: 210,
      g: 170,
      b: 145,
      alpha: 1,
    });

    mockExtractPdfCandidates.mockResolvedValueOnce([
      {
        buffer: portrait,
        width: 420,
        height: 560,
        kind: 2,
        name: 'portrait_1',
        source: 'pdf_embedded',
      },
    ]);

    const result = await extractAvatar({
      buffer: Buffer.from('%PDF-1.7\n'),
      mime: 'application/pdf',
    });

    expect(result.status).toBe('found');
    if (result.status === 'found') {
      expect(result.confidence).toBeGreaterThan(0.35);
      expect(result.avatar.length).toBeGreaterThan(0);
    }
  });

  it('trả not_found/all_filtered khi ảnh bị loại ở prefilter', async () => {
    const tiny = await createSolidPng({
      width: 60,
      height: 60,
      r: 255,
      g: 255,
      b: 255,
    });

    mockExtractPdfCandidates.mockResolvedValueOnce([
      {
        buffer: tiny,
        width: 60,
        height: 60,
        kind: 2,
        name: 'tiny_1',
        source: 'pdf_embedded',
      },
    ]);

    const result = await extractAvatar({
      buffer: Buffer.from('%PDF-1.7\n'),
      mime: 'application/pdf',
    });

    expect(result.status).toBe('not_found');
    if (result.status === 'not_found') {
      expect(result.code).toBe('all_filtered');
    }
  });
});

describe('isPlaceholderCandidateAvatarUrl', () => {
  it('nhận diện đúng pravatar placeholder', () => {
    expect(isPlaceholderCandidateAvatarUrl(null)).toBe(false);
    expect(isPlaceholderCandidateAvatarUrl('')).toBe(false);
    expect(isPlaceholderCandidateAvatarUrl('https://i.pravatar.cc/150?u=a@b.com')).toBe(true);
    expect(isPlaceholderCandidateAvatarUrl('https://cdn.example.com/users/u1/avatar/x.jpg')).toBe(
      false
    );
  });
});
