import { AppError } from '@/shared/errors/errorHandler';

const FETCH_TIMEOUT_MS = 30_000;
const MAX_CV_FILE_SIZE = 10 * 1024 * 1024;

const DRIVE_ALLOWLIST_HOSTS = new Set([
  'drive.google.com',
  'docs.google.com',
  'drive.usercontent.google.com',
]);

const PDF_MIME = 'application/pdf';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export interface FetchedCvFile {
  buffer: Buffer;
  mime: typeof PDF_MIME | typeof DOCX_MIME;
  extension: '.pdf' | '.docx';
  fileName: string;
  sourceUrl: string;
}

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (host === 'metadata.google.internal') return true;

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }

  return false;
}

function assertSafeUrl(rawUrl: string, { allowAnyPublicHost }: { allowAnyPublicHost: boolean }): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new AppError('Link CV không hợp lệ', 400, 'CV_LINK_INVALID_URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new AppError('Link CV phải là http/https', 400, 'CV_LINK_INVALID_PROTOCOL');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname || isPrivateHostname(hostname)) {
    throw new AppError('Host của link CV không được phép', 400, 'CV_LINK_HOST_BLOCKED');
  }

  if (!allowAnyPublicHost && !DRIVE_ALLOWLIST_HOSTS.has(hostname)) {
    throw new AppError('Host của link CV không nằm trong danh sách cho phép', 400, 'CV_LINK_HOST_NOT_ALLOWED');
  }

  return parsed;
}

export function extractGoogleDriveFileId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const fileMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/);
    if (fileMatch?.[1]) return fileMatch[1];
    const idParam = parsed.searchParams.get('id');
    if (idParam) return idParam;
    return null;
  } catch {
    return null;
  }
}

export function extractGoogleDocId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/document\/d\/([^/]+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function buildDriveDownloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
}

export function buildGoogleDocExportPdfUrl(docId: string): string {
  return `https://docs.google.com/document/d/${encodeURIComponent(docId)}/export?format=pdf`;
}

function sniffMime(buffer: Buffer, contentTypeHeader: string | null): typeof PDF_MIME | typeof DOCX_MIME | null {
  const header = (contentTypeHeader || '').toLowerCase().split(';')[0]?.trim() ?? '';
  if (header === PDF_MIME || header === 'application/x-pdf') return PDF_MIME;
  if (header === DOCX_MIME) return DOCX_MIME;

  // PDF magic
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString('utf8') === '%PDF') {
    return PDF_MIME;
  }

  // DOCX is ZIP (PK)
  if (buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b) {
    if (header.includes('officedocument') || header.includes('zip') || header === '' || header === 'application/octet-stream') {
      return DOCX_MIME;
    }
  }

  return null;
}

function looksLikeHtml(buffer: Buffer): boolean {
  const head = buffer.subarray(0, Math.min(buffer.length, 200)).toString('utf8').toLowerCase();
  return head.includes('<!doctype html') || head.includes('<html') || head.includes('<head');
}

async function fetchWithGuards(
  url: string,
  options: { allowAnyPublicHost: boolean; redirectCount?: number },
): Promise<{ buffer: Buffer; contentType: string | null; finalUrl: string }> {
  const redirectCount = options.redirectCount ?? 0;
  if (redirectCount > 5) {
    throw new AppError('Link CV bị redirect quá nhiều lần', 400, 'CV_LINK_TOO_MANY_REDIRECTS');
  }

  assertSafeUrl(url, { allowAnyPublicHost: options.allowAnyPublicHost });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'User-Agent': 'JoyWorkCVFetcher/1.0',
        Accept: 'application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,*/*',
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        throw new AppError('Link CV redirect không hợp lệ', 400, 'CV_LINK_BAD_REDIRECT');
      }
      const nextUrl = new URL(location, url).toString();
      // Redirect hops must stay on allowlisted hosts for Drive, or public hosts for direct files
      return fetchWithGuards(nextUrl, {
        allowAnyPublicHost: options.allowAnyPublicHost,
        redirectCount: redirectCount + 1,
      });
    }

    if (!response.ok) {
      throw new AppError(
        `Không tải được CV từ link (HTTP ${response.status})`,
        400,
        'CV_LINK_FETCH_FAILED',
      );
    }

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_CV_FILE_SIZE) {
      throw new AppError('CV vượt quá 10MB', 413, 'CV_LINK_FILE_TOO_LARGE');
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.byteLength > MAX_CV_FILE_SIZE) {
      throw new AppError('CV vượt quá 10MB', 413, 'CV_LINK_FILE_TOO_LARGE');
    }
    if (buffer.byteLength === 0) {
      throw new AppError('File CV từ link bị rỗng', 422, 'CV_LINK_EMPTY_FILE');
    }

    return {
      buffer,
      contentType: response.headers.get('content-type'),
      finalUrl: url,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AppError('Hết thời gian tải CV từ link', 408, 'CV_LINK_TIMEOUT');
    }
    throw new AppError('Không tải được CV từ link', 400, 'CV_LINK_FETCH_FAILED');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tải file CV từ link ngoài (Drive file / Google Docs / direct PDF|DOCX).
 * SSRF-safe: allowlist Drive hosts; direct file chặn private IP; cap 10MB; chỉ PDF/DOCX.
 */
export async function fetchCvFromExternalLink(rawUrl: string): Promise<FetchedCvFile> {
  const trimmed = rawUrl.trim();
  const lower = trimmed.toLowerCase();

  let downloadUrl = trimmed;
  let allowAnyPublicHost = false;
  let suggestedName = 'cv.pdf';
  let forceMime: typeof PDF_MIME | typeof DOCX_MIME | null = null;

  if (lower.includes('drive.google.com/file/') || (lower.includes('drive.google.com') && lower.includes('id='))) {
    const fileId = extractGoogleDriveFileId(trimmed);
    if (!fileId) {
      throw new AppError('Không đọc được ID file Google Drive', 400, 'CV_LINK_DRIVE_ID_INVALID');
    }
    downloadUrl = buildDriveDownloadUrl(fileId);
    suggestedName = `drive-${fileId}.pdf`;
  } else if (lower.includes('docs.google.com/document/')) {
    const docId = extractGoogleDocId(trimmed);
    if (!docId) {
      throw new AppError('Không đọc được ID Google Docs', 400, 'CV_LINK_DOC_ID_INVALID');
    }
    downloadUrl = buildGoogleDocExportPdfUrl(docId);
    suggestedName = `doc-${docId}.pdf`;
    forceMime = PDF_MIME;
  } else {
    const parsed = assertSafeUrl(trimmed, { allowAnyPublicHost: true });
    const pathname = parsed.pathname.toLowerCase();
    if (!pathname.endsWith('.pdf') && !pathname.endsWith('.docx')) {
      throw new AppError(
        'Chỉ hỗ trợ link Drive/Docs hoặc URL trực tiếp tới file PDF/DOCX',
        400,
        'CV_LINK_UNSUPPORTED',
      );
    }
    allowAnyPublicHost = true;
    suggestedName = pathname.split('/').pop() || suggestedName;
  }

  const { buffer, contentType, finalUrl } = await fetchWithGuards(downloadUrl, { allowAnyPublicHost });

  if (looksLikeHtml(buffer)) {
    throw new AppError(
      'Không tải được file CV (link có thể chưa mở công khai hoặc yêu cầu đăng nhập)',
      400,
      'CV_LINK_NOT_PUBLIC',
    );
  }

  const mime = forceMime ?? sniffMime(buffer, contentType);
  if (!mime) {
    throw new AppError(
      'Định dạng file từ link không phải PDF/DOCX',
      400,
      'CV_LINK_UNSUPPORTED_TYPE',
    );
  }

  return {
    buffer,
    mime,
    extension: mime === PDF_MIME ? '.pdf' : '.docx',
    fileName: suggestedName.endsWith('.pdf') || suggestedName.endsWith('.docx')
      ? suggestedName
      : `${suggestedName}${mime === PDF_MIME ? '.pdf' : '.docx'}`,
    sourceUrl: finalUrl,
  };
}
