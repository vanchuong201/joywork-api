import bcrypt from 'bcrypt';

/**
 * Centralized password hashing.
 *
 * Dùng `bcrypt` native (chạy trên libuv threadpool, async — KHÔNG block event loop)
 * thay cho `bcryptjs` thuần JS. Đây là điểm nghẽn chính khi nhiều đăng ký/đăng nhập
 * đồng thời: bcryptjs băm đồng bộ trên event loop làm treo toàn bộ request.
 *
 * Cost factor đặt tập trung tại 1 nơi để dễ tinh chỉnh theo năng lực CPU.
 * Hash cũ do bcryptjs tạo (prefix `$2b$`, cost 12) vẫn verify được bằng bcrypt native,
 * nên không cần migrate hàng loạt.
 */
export const BCRYPT_COST = 10;

/** Băm mật khẩu plaintext. */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

/** So khớp mật khẩu plaintext với hash đã lưu. */
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
