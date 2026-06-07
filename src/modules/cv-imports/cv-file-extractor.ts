import JSZip from 'jszip';
import { AppError } from '@/shared/errors/errorHandler';
import { config } from '@/config/env';

const PDF_MIME = 'application/pdf';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const SUPPORTED_MIME_TYPES = new Set([PDF_MIME, DOCX_MIME]);

const MIN_USEFUL_TEXT_LENGTH = 120;

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

export async function extractCvText(params: {
  buffer: Buffer;
  mime: SupportedCvMime;
}): Promise<ExtractCvTextResult> {
  const { buffer, mime } = params;

  let raw: string;
  if (mime === PDF_MIME) {
    raw = await extractPdfText(buffer);
  } else {
    raw = await extractDocxText(buffer);
  }

  const normalized = normalizeWhitespace(raw);
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
  };
}

export const CV_IMPORT_PDF_MIME = PDF_MIME;
export const CV_IMPORT_DOCX_MIME = DOCX_MIME;
