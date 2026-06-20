import { describe, it, expect } from 'vitest';
import bcrypt from 'bcrypt';
import { hashPassword, verifyPassword, BCRYPT_COST } from './password-hash';

const PASSWORD = 'Secret123!';

describe('password-hash', () => {
  it('hashPassword tạo hash $2b$ đúng cost và verify được', async () => {
    const hash = await hashPassword(PASSWORD);
    expect(hash).toMatch(new RegExp(`^\\$2b\\$0?${BCRYPT_COST}\\$`));
    expect(await verifyPassword(PASSWORD, hash)).toBe(true);
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  // Backward-compat: user cũ có hash do bcryptjs tạo (prefix $2b$, cost 12).
  // Hash native bcrypt cost 12 cùng định dạng MCF với bcryptjs → đại diện hợp lệ.
  it('verify được hash legacy cost 12 (định dạng bcryptjs)', async () => {
    const legacy = await bcrypt.hash(PASSWORD, 12);
    expect(legacy).toMatch(/^\$2b\$12\$/);
    expect(await verifyPassword(PASSWORD, legacy)).toBe(true);
    expect(await verifyPassword('wrong-password', legacy)).toBe(false);
  });

  // Tolerate prefix $2a$ (một số hash cũ dùng prefix này). $2a$ và $2b$ cho cùng
  // kết quả với mật khẩu ASCII → đổi prefix vẫn verify đúng.
  it('verify được hash prefix $2a$ (legacy)', async () => {
    const legacy2b = await bcrypt.hash(PASSWORD, 12);
    const legacy2a = legacy2b.replace(/^\$2b\$/, '$2a$');
    expect(legacy2a).toMatch(/^\$2a\$12\$/);
    expect(await verifyPassword(PASSWORD, legacy2a)).toBe(true);
  });
});
