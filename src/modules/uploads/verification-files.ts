/** Key cũ được phép xóa khi nộp lại hồ sơ xác thực. Bỏ key client gửi lên. */
export function previousVerificationObjectKey(
  companyId: string,
  currentKey: string | null | undefined,
  nextKey: string,
): string | null {
  if (!currentKey || currentKey === nextKey) return null;
  const prefix = `companies/${companyId}/verification/`;
  if (!currentKey.startsWith(prefix) || currentKey.includes('..')) return null;
  return currentKey;
}
