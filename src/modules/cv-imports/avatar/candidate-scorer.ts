import sharp from 'sharp';
import type { RawCandidate, ScoredCandidate } from './types';

const WEIGHTS = {
  skin: 0.45,
  entropy: 0.2,
  aspect: 0.15,
  area: 0.1,
  noAlpha: 0.1,
} as const;

export const DECISION = {
  MIN_SCORE: 0.35,
  CLEAR_MARGIN: 0.15,
} as const;

/**
 * Kovac skin-tone rule.
 * Dùng ngưỡng rộng để hạn chế bias tông da tối.
 */
export function isSkinPixel(r: number, g: number, b: number): boolean {
  return (
    r > 95 &&
    g > 40 &&
    b > 20 &&
    Math.max(r, g, b) - Math.min(r, g, b) > 15 &&
    Math.abs(r - g) > 15 &&
    r > g &&
    r > b
  );
}

export function buildRejectedScoredCandidate(
  candidate: RawCandidate,
  reason: string
): ScoredCandidate {
  return {
    ...candidate,
    score: 0,
    signals: {
      skinRatio: 0,
      entropy: 0,
      aspectRatio: candidate.height > 0 ? candidate.width / candidate.height : 0,
      relativeArea: 0,
      hasAlphaChannel: candidate.kind === 3,
    },
    rejectedReason: reason,
  };
}

export async function scoreCandidate(
  candidate: RawCandidate,
  maxArea: number
): Promise<ScoredCandidate> {
  const image = sharp(candidate.buffer);

  const { data, info } = await image
    .clone()
    .removeAlpha()
    .resize(64, 64, { fit: 'cover' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let skinCount = 0;
  const pixelCount = 64 * 64;
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    if (isSkinPixel(r, g, b)) {
      skinCount += 1;
    }
  }
  const skinRatio = skinCount / pixelCount;

  const stats = await image.clone().stats();
  const entropy = stats.entropy ?? 0;

  const aspectRatio = candidate.width / candidate.height;
  const relativeArea = Math.min((candidate.width * candidate.height) / Math.max(maxArea, 1), 1);
  const hasAlphaChannel = candidate.kind === 3;

  const sSkin = Math.min(skinRatio / 0.25, 1);
  const sEntropy = Math.min(Math.max((entropy - 1) / 5, 0), 1);
  const sAspect = Math.max(0, 1 - Math.abs(aspectRatio - 0.75) / 0.75);
  const sArea = relativeArea;
  const sNoAlpha = hasAlphaChannel ? 0 : 1;

  const score =
    WEIGHTS.skin * sSkin +
    WEIGHTS.entropy * sEntropy +
    WEIGHTS.aspect * sAspect +
    WEIGHTS.area * sArea +
    WEIGHTS.noAlpha * sNoAlpha;

  return {
    ...candidate,
    score,
    signals: {
      skinRatio,
      entropy,
      aspectRatio,
      relativeArea,
      hasAlphaChannel,
    },
  };
}

export async function scoreCandidates(candidates: RawCandidate[]): Promise<ScoredCandidate[]> {
  if (candidates.length === 0) return [];

  const maxArea = Math.max(...candidates.map((candidate) => candidate.width * candidate.height));
  const scored = await Promise.all(candidates.map((candidate) => scoreCandidate(candidate, maxArea)));
  return scored.sort((a, b) => b.score - a.score);
}
