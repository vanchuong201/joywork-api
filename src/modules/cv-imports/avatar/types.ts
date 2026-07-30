export type PdfImageKind = 1 | 2 | 3;

export type CandidateSource = 'pdf_embedded' | 'docx_media';

/** Ảnh thô, đã normalize shape giữa PDF và DOCX. */
export interface RawCandidate {
  buffer: Buffer;
  width: number;
  height: number;
  kind?: PdfImageKind;
  name: string;
  source: CandidateSource;
}

export interface ScoredCandidate extends RawCandidate {
  score: number;
  signals: {
    skinRatio: number;
    entropy: number;
    aspectRatio: number;
    relativeArea: number;
    hasAlphaChannel: boolean;
  };
  rejectedReason?: string;
}

export type AvatarExtractionResult =
  | {
      status: 'found';
      avatar: Buffer;
      confidence: number;
      isConfident: boolean;
      debug: ScoredCandidate[];
    }
  | {
      status: 'not_found' | 'unsupported_file';
      reason: string;
      code: string;
      debug?: ScoredCandidate[];
    };
