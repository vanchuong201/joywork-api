import { describe, expect, it } from 'vitest';
import { parseMissingContactIndexes } from './brevo.service';

describe('parseMissingContactIndexes', () => {
  it('parses single and multiple indexes', () => {
    expect(parseMissingContactIndexes('No contact found for indexes 11')).toEqual([11]);
    expect(parseMissingContactIndexes('No contact found for indexes 24,39')).toEqual([24, 39]);
    expect(parseMissingContactIndexes('No contact found for indexes 2,6,18,28')).toEqual([
      2, 6, 18, 28,
    ]);
  });

  it('returns empty for unrelated messages', () => {
    expect(parseMissingContactIndexes('rate limit')).toEqual([]);
  });
});
