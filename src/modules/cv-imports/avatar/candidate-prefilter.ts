import { LIMITS } from './limits';
import type { RawCandidate } from './types';

export function prefilterCandidate(candidate: RawCandidate): string | null {
  if (candidate.width < 100 || candidate.height < 100) return 'too_small';

  const aspectRatio = candidate.width / candidate.height;
  if (aspectRatio > 2.5) return 'too_wide';
  if (aspectRatio < 0.35) return 'too_tall';

  if (candidate.kind === 1) return 'bitonal';

  if (candidate.width * candidate.height > LIMITS.maxDecodedImagePixels) return 'too_large';

  return null;
}
