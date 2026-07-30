import type { SupportedCvMime } from '../cv-file-extractor';
import { normalizeAvatar } from './avatar-normalizer';
import { extractDocxCandidates } from './candidate-extractor-docx';
import { extractPdfCandidates } from './candidate-extractor-pdf';
import { prefilterCandidate } from './candidate-prefilter';
import {
  buildRejectedScoredCandidate,
  DECISION,
  scoreCandidates,
} from './candidate-scorer';
import { LIMITS } from './limits';
import type { AvatarExtractionResult, RawCandidate, ScoredCandidate } from './types';

function hasPdfMagic(buffer: Buffer): boolean {
  if (buffer.length < 5) return false;
  return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
}

function hasDocxMagic(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  return (
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07) &&
    (buffer[3] === 0x04 || buffer[3] === 0x06 || buffer[3] === 0x08)
  );
}

function isEncryptedPdfError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const normalized = error.message.toLowerCase();
  return normalized.includes('password') || normalized.includes('encrypted');
}

function looksLikeScannedDocument(candidates: RawCandidate[], mime: SupportedCvMime): boolean {
  if (mime !== 'application/pdf') return false;
  if (candidates.length !== 1) return false;
  const [first] = candidates;
  if (!first) return false;
  const area = first.width * first.height;
  return area >= 1_800_000 && first.width >= 900 && first.height >= 900;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('avatar_scoring_timeout'));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function buildNotFoundResult(
  reason: string,
  code: string,
  debug?: ScoredCandidate[]
): AvatarExtractionResult {
  return {
    status: 'not_found',
    reason,
    code,
    ...(debug ? { debug } : {}),
  };
}

export async function extractAvatar(params: {
  buffer: Buffer;
  mime: SupportedCvMime;
}): Promise<AvatarExtractionResult> {
  const { buffer, mime } = params;

  if (buffer.byteLength <= 0) {
    return {
      status: 'unsupported_file',
      reason: 'File CV rỗng',
      code: 'empty_file',
    };
  }

  if (buffer.byteLength > LIMITS.maxFileSizeBytes) {
    return {
      status: 'unsupported_file',
      reason: 'File CV vượt quá giới hạn cho phép',
      code: 'file_too_large',
    };
  }

  if (mime === 'application/pdf' && !hasPdfMagic(buffer)) {
    return {
      status: 'unsupported_file',
      reason: 'File không đúng định dạng PDF',
      code: 'invalid_magic_bytes',
    };
  }

  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' && !hasDocxMagic(buffer)) {
    return {
      status: 'unsupported_file',
      reason: 'File không đúng định dạng DOCX',
      code: 'invalid_magic_bytes',
    };
  }

  try {
    const extractedCandidates =
      mime === 'application/pdf'
        ? await extractPdfCandidates(buffer)
        : await extractDocxCandidates(buffer);

    if (extractedCandidates.length === 0) {
      return buildNotFoundResult(
        'Không có ảnh nhúng trong CV để trích xuất avatar',
        'no_embedded_images'
      );
    }

    const rejected: ScoredCandidate[] = [];
    const accepted: RawCandidate[] = [];
    for (const candidate of extractedCandidates) {
      const reason = prefilterCandidate(candidate);
      if (reason) {
        rejected.push(buildRejectedScoredCandidate(candidate, reason));
        continue;
      }
      accepted.push(candidate);
    }

    if (accepted.length === 0) {
      const scanned = looksLikeScannedDocument(extractedCandidates, mime);
      return buildNotFoundResult(
        scanned
          ? 'CV dạng scan không có ảnh chân dung tách riêng'
          : 'Tất cả ảnh nhúng đều không phù hợp làm avatar',
        scanned ? 'scanned_document' : 'all_filtered',
        rejected
      );
    }

    const boundedCandidates = accepted.slice(0, LIMITS.maxCandidates);
    const scoredCandidates = await withTimeout(
      scoreCandidates(boundedCandidates),
      LIMITS.scoringTimeoutMs
    );
    const debug = [...scoredCandidates, ...rejected];

    const top1 = scoredCandidates[0];
    if (!top1 || top1.score < DECISION.MIN_SCORE) {
      const scanned = looksLikeScannedDocument(extractedCandidates, mime);
      return buildNotFoundResult(
        scanned
          ? 'CV dạng scan không nhận diện được avatar chắc chắn'
          : 'Không có ảnh đạt độ tin cậy tối thiểu để chọn avatar',
        scanned ? 'scanned_document' : 'below_threshold',
        debug
      );
    }

    const avatar = await normalizeAvatar(top1.buffer);
    const top2Score = scoredCandidates[1]?.score ?? 0;

    return {
      status: 'found',
      avatar,
      confidence: top1.score,
      isConfident: top1.score - top2Score >= DECISION.CLEAR_MARGIN,
      debug,
    };
  } catch (error) {
    if (isEncryptedPdfError(error)) {
      return {
        status: 'unsupported_file',
        reason: 'PDF có mật khẩu hoặc bị mã hóa',
        code: 'encrypted',
      };
    }

    if (error instanceof Error && error.message === 'avatar_scoring_timeout') {
      return buildNotFoundResult(
        'Hết thời gian chấm điểm avatar từ CV',
        'scoring_timeout'
      );
    }

    return buildNotFoundResult(
      'Không thể trích xuất ảnh đại diện từ CV',
      'extract_failed'
    );
  }
}
