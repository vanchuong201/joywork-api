import { CandidateCvLinkType } from '@prisma/client';
import { z } from 'zod';

export const CANDIDATE_IMPORT_MIME_TYPES = [
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

export const candidateImportResendSchema = z.object({
  recordId: z.string().cuid(),
});

export type CandidateImportResendInput = z.infer<typeof candidateImportResendSchema>;

export type CandidateImportDryRunStatus =
  | 'VALID'
  | 'EXISTING_EMAIL'
  | 'DUPLICATE_EMAIL_IN_FILE'
  | 'INVALID';

export type CandidateImportLinkAction = 'AUTO_FETCHABLE' | 'MANUAL_UPLOAD' | 'EMPTY';

export interface CandidateImportRow {
  rowNumber: number;
  email: string | null;
  name: string | null;
  phone: string | null;
  province: string | null;
  district: string | null;
  position: string | null;
  salary: string | null;
  experience: string | null;
  socialLink: string | null;
  cvLink: string | null;
  portfolioLink: string | null;
}

export interface CandidateImportDryRunRow extends CandidateImportRow {
  status: CandidateImportDryRunStatus;
  issues: string[];
  cvLinkType: CandidateCvLinkType;
  linkAction: CandidateImportLinkAction;
}

export interface CandidateImportDryRunReport {
  fileName: string;
  totalRows: number;
  validRows: number;
  existingRows: number;
  duplicateRows: number;
  invalidRows: number;
  linkSummary: {
    autoFetchable: number;
    manualUpload: number;
    empty: number;
    byType: Record<CandidateCvLinkType, number>;
  };
  rows: CandidateImportDryRunRow[];
}
