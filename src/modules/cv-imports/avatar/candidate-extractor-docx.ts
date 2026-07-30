import JSZip from 'jszip';
import sharp, { type Metadata } from 'sharp';
import type { PdfImageKind, RawCandidate } from './types';

function inferKindFromMetadata(metadata: Metadata): PdfImageKind {
  if (metadata.channels === 1) return 1;
  if (metadata.hasAlpha || (typeof metadata.channels === 'number' && metadata.channels >= 4)) {
    return 3;
  }
  return 2;
}

function isSupportedDocxImage(pathName: string): boolean {
  return /\.(jpe?g|png|webp)$/i.test(pathName);
}

export async function extractDocxCandidates(buffer: Buffer): Promise<RawCandidate[]> {
  const zip = await JSZip.loadAsync(buffer);
  const entries = Object.keys(zip.files)
    .filter((entry) => {
      const file = zip.files[entry];
      return Boolean(file && !file.dir && /^word\/media\//i.test(entry));
    })
    .sort((a, b) => a.localeCompare(b));

  const candidates: RawCandidate[] = [];
  for (const entry of entries) {
    if (!isSupportedDocxImage(entry)) continue;

    const file = zip.file(entry);
    if (!file) continue;

    const imageBuffer = Buffer.from(await file.async('uint8array'));
    if (imageBuffer.length === 0) continue;

    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    if (width <= 0 || height <= 0) continue;

    candidates.push({
      buffer: imageBuffer,
      width,
      height,
      kind: inferKindFromMetadata(metadata),
      name: entry,
      source: 'docx_media',
    });
  }

  return candidates;
}
