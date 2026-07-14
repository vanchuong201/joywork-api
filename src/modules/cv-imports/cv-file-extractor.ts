import { execFile } from 'node:child_process';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import JSZip from 'jszip';
import { AppError } from '@/shared/errors/errorHandler';
import { config } from '@/config/env';

const PDF_MIME = 'application/pdf';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const SUPPORTED_MIME_TYPES = new Set([PDF_MIME, DOCX_MIME]);

const MIN_USEFUL_TEXT_LENGTH = 120;
const OCR_MAX_PAGES = 5;
const OCR_DPI = 180;
const OCR_LANGUAGE = 'vie+eng';
const OCR_RENDER_TIMEOUT_MS = 20_000;
const OCR_PER_PAGE_TIMEOUT_MS = 12_000;
const OCR_MAX_BUFFER = 10 * 1024 * 1024;

const execFileAsync = promisify(execFile);

interface ExecFileError extends Error {
  code?: string | number;
}

export type SupportedCvMime = typeof PDF_MIME | typeof DOCX_MIME;

export function isSupportedCvMime(mime: string | null | undefined): mime is SupportedCvMime {
  if (!mime) return false;
  return SUPPORTED_MIME_TYPES.has(mime);
}

export function inferMimeFromKey(key: string | null | undefined): SupportedCvMime | null {
  if (!key) return null;
  const lower = key.toLowerCase();
  if (lower.endsWith('.pdf')) return PDF_MIME;
  if (lower.endsWith('.docx')) return DOCX_MIME;
  return null;
}

export interface ExtractCvTextResult {
  text: string;
  mime: SupportedCvMime;
  charCount: number;
  truncated: boolean;
  warnings: string[];
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  // pdf-parse v2 expects ESM dynamic import.
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText({ pageJoiner: '\n', lineEnforce: true });
    return result.text ?? '';
  } finally {
    try {
      await parser.destroy();
    } catch {
      // Bỏ qua: chỉ là cleanup PDF.js.
    }
  }
}

function extractPageIndex(fileName: string): number {
  const match = fileName.match(/-(\d+)\.(?:jpg|jpeg|png)$/i);
  return match?.[1] ? Number.parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
}

function isMissingBinaryError(error: unknown): boolean {
  const err = error as ExecFileError | undefined;
  return err?.code === 'ENOENT';
}

async function extractPdfTextWithOcr(buffer: Buffer): Promise<{ text: string; warnings: string[] }> {
  const embeddedText = normalizeWhitespace(await extractPdfText(buffer));
  if (embeddedText.length >= MIN_USEFUL_TEXT_LENGTH) {
    return { text: embeddedText, warnings: [] };
  }

  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'joywork-cv-ocr-'));
  const inputPath = path.join(tmpDir, 'source.pdf');
  const outputPrefix = path.join(tmpDir, 'page');

  try {
    await writeFile(inputPath, buffer);
    await execFileAsync(
      'pdftoppm',
      ['-jpeg', '-r', String(OCR_DPI), '-f', '1', '-l', String(OCR_MAX_PAGES), inputPath, outputPrefix],
      {
        timeout: OCR_RENDER_TIMEOUT_MS,
        maxBuffer: OCR_MAX_BUFFER,
      }
    );

    const files = await readdir(tmpDir);
    const imageFiles = files
      .filter((name) => /^page-\d+\.(?:jpg|jpeg)$/i.test(name))
      .sort((a, b) => extractPageIndex(a) - extractPageIndex(b));

    const chunks: string[] = [];
    for (const fileName of imageFiles) {
      const imagePath = path.join(tmpDir, fileName);
      const { stdout } = await execFileAsync(
        'tesseract',
        [imagePath, 'stdout', '-l', OCR_LANGUAGE, '--psm', '6'],
        {
          timeout: OCR_PER_PAGE_TIMEOUT_MS,
          maxBuffer: OCR_MAX_BUFFER,
        }
      );
      if (typeof stdout === 'string' && stdout.trim().length > 0) {
        chunks.push(stdout);
      }
    }

    const ocrText = normalizeWhitespace(chunks.join('\n\n'));
    if (ocrText.length >= MIN_USEFUL_TEXT_LENGTH) {
      return {
        text: ocrText,
        warnings: ['CV dạng ảnh/scan, dữ liệu được đọc bằng OCR nên có thể cần kiểm tra lại.'],
      };
    }

    return { text: embeddedText, warnings: [] };
  } catch (error) {
    if (isMissingBinaryError(error)) {
      throw new AppError(
        'Máy chủ chưa hỗ trợ OCR cho CV dạng ảnh. Vui lòng thử lại bằng PDF có text hoặc file DOCX.',
        503,
        'CV_IMPORT_OCR_UNAVAILABLE'
      );
    }
    return { text: embeddedText, warnings: [] };
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

function stripXmlTags(xml: string): string {
  return xml
    .replace(/<w:p[\s>]/g, '\n<w:p ')
    .replace(/<w:br[\s/>]/g, '\n')
    .replace(/<w:tab[\s/>]/g, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const docXml = zip.file('word/document.xml');
  if (!docXml) {
    throw new AppError('DOCX không hợp lệ hoặc không chứa nội dung', 422, 'CV_IMPORT_INVALID_DOCX');
  }
  const xml = await docXml.async('string');
  const text = stripXmlTags(xml);
  return text.replace(/\u00A0/g, ' ');
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r/g, '\n')
    .replace(/\u2028|\u2029/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Canva (và một số designer export) thường tách heading bằng letter-spacing,
 * khiến extract ra kiểu "H Ọ C V Ấ N". Ghép các chuỗi 1-ký-tự cách nhau bởi space.
 * Chỉ dùng space/tab (không dùng \\s) để không gộp các dòng heading liền nhau.
 * Giữ nguyên số điện thoại kiểu "0966 805 348" và câu thường.
 */
export function collapseSpacedLetters(text: string): string {
  return text.replace(
    /(?<![\p{L}\p{N}])((?:[\p{L}\p{N}][ \t]){2,}[\p{L}\p{N}])(?![\p{L}\p{N}])/gu,
    (match) => {
      const parts = match.trim().split(/[ \t]+/);
      if (parts.length < 3) return match;
      if (!parts.every((part) => part.length === 1)) return match;

      const digitCount = parts.filter((part) => /^\d$/u.test(part)).length;
      // Giữ nhóm số kiểu SĐT/năm có khoảng cách.
      if (digitCount >= Math.ceil(parts.length * 0.6)) return match;

      return parts.join('');
    }
  );
}

export async function extractCvText(params: {
  buffer: Buffer;
  mime: SupportedCvMime;
}): Promise<ExtractCvTextResult> {
  const { buffer, mime } = params;

  let raw: string;
  let warnings: string[] = [];
  if (mime === PDF_MIME) {
    const extracted = await extractPdfTextWithOcr(buffer);
    raw = extracted.text;
    warnings = extracted.warnings;
  } else {
    raw = await extractDocxText(buffer);
  }

  const normalized = collapseSpacedLetters(normalizeWhitespace(raw));
  if (normalized.length < MIN_USEFUL_TEXT_LENGTH) {
    throw new AppError(
      'CV không đọc được nội dung văn bản. Vui lòng dùng file PDF/DOCX không phải ảnh scan.',
      422,
      'CV_IMPORT_EMPTY_TEXT'
    );
  }

  const limit = config.CV_IMPORT_MAX_TEXT_CHARS;
  const truncated = normalized.length > limit;
  const text = truncated ? normalized.slice(0, limit) : normalized;
  return {
    text,
    mime,
    charCount: normalized.length,
    truncated,
    warnings,
  };
}

export const CV_IMPORT_PDF_MIME = PDF_MIME;
export const CV_IMPORT_DOCX_MIME = DOCX_MIME;
