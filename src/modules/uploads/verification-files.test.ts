import { describe, expect, it } from 'vitest';
import { previousVerificationObjectKey } from './verification-files';

describe('previousVerificationObjectKey', () => {
  const companyId = 'cmp123';

  it('returns the stored key so a re-upload can delete it without a client key', () => {
    expect(
      previousVerificationObjectKey(
        companyId,
        'companies/cmp123/verification/old.pdf',
        'companies/cmp123/verification/new.pdf',
      ),
    ).toBe('companies/cmp123/verification/old.pdf');
  });

  it('ignores a missing key, the same key, and keys outside the company prefix', () => {
    expect(previousVerificationObjectKey(companyId, null, 'companies/cmp123/verification/new.pdf')).toBeNull();
    expect(
      previousVerificationObjectKey(
        companyId,
        'companies/cmp123/verification/same.pdf',
        'companies/cmp123/verification/same.pdf',
      ),
    ).toBeNull();
    expect(
      previousVerificationObjectKey(companyId, 'companies/other/verification/old.pdf', 'companies/cmp123/verification/new.pdf'),
    ).toBeNull();
    expect(
      previousVerificationObjectKey(
        companyId,
        'companies/cmp123/verification/../../secret',
        'companies/cmp123/verification/new.pdf',
      ),
    ).toBeNull();
  });
});
