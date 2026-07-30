/**
 * Avatar “giả” từng gắn khi import (pravatar stock photo).
 * Không dùng cho hồ sơ thật — UI sẽ fallback initials (ui-avatars) khi null.
 */
export function isPlaceholderCandidateAvatarUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    return host === 'i.pravatar.cc' || host.endsWith('.pravatar.cc');
  } catch {
    return false;
  }
}

/** @deprecated Không còn gắn avatar giả khi import. Giữ để seed/test cũ nếu cần. */
export function buildDefaultCandidateAvatarUrl(email: string): string {
  const normalized = email.trim().toLowerCase();
  return `https://i.pravatar.cc/150?u=${encodeURIComponent(normalized)}`;
}
