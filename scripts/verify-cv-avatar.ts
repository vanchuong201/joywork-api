import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  buildRejectedScoredCandidate,
  scoreCandidates,
} from '../src/modules/cv-imports/avatar/candidate-scorer';
import { extractDocxCandidates } from '../src/modules/cv-imports/avatar/candidate-extractor-docx';
import { extractPdfCandidates } from '../src/modules/cv-imports/avatar/candidate-extractor-pdf';
import { prefilterCandidate } from '../src/modules/cv-imports/avatar/candidate-prefilter';
import type { RawCandidate, ScoredCandidate } from '../src/modules/cv-imports/avatar/types';

function inferMime(filePath: string): 'application/pdf' | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  throw new Error(`Unsupported file extension: ${filePath}`);
}

async function analyzeFile(filePath: string): Promise<void> {
  const absolutePath = path.resolve(filePath);
  const mime = inferMime(absolutePath);
  const buffer = await readFile(absolutePath);

  const rawCandidates =
    mime === 'application/pdf'
      ? await extractPdfCandidates(buffer)
      : await extractDocxCandidates(buffer);

  const accepted: RawCandidate[] = [];
  const rejected: ScoredCandidate[] = [];
  for (const candidate of rawCandidates) {
    const reason = prefilterCandidate(candidate);
    if (reason) {
      rejected.push(buildRejectedScoredCandidate(candidate, reason));
      continue;
    }
    accepted.push(candidate);
  }

  const scored = await scoreCandidates(accepted);
  const all = [...scored, ...rejected];

  // eslint-disable-next-line no-console
  console.log(`\n=== ${absolutePath} ===`);
  // eslint-disable-next-line no-console
  console.log(`mime=${mime} raw=${rawCandidates.length} accepted=${accepted.length} rejected=${rejected.length}`);
  // eslint-disable-next-line no-console
  console.log('name\twidth\theight\tkind\tskinRatio\tentropy\tscore\trejectedReason');

  for (const candidate of all) {
    // eslint-disable-next-line no-console
    console.log(
      `${candidate.name}\t${candidate.width}\t${candidate.height}\t${candidate.kind ?? '-'}\t${candidate.signals.skinRatio.toFixed(4)}\t${candidate.signals.entropy.toFixed(4)}\t${candidate.score.toFixed(4)}\t${candidate.rejectedReason ?? ''}`
    );
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    // eslint-disable-next-line no-console
    console.error('Usage: npx tsx scripts/verify-cv-avatar.ts <file1.pdf|docx> [file2 ...]');
    process.exit(1);
  }

  for (const filePath of args) {
    await analyzeFile(filePath);
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
