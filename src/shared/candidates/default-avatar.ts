/** Avatar mặc định deterministic theo email (cùng pattern seed). */
export function buildDefaultCandidateAvatarUrl(email: string): string {
  const normalized = email.trim().toLowerCase();
  return `https://i.pravatar.cc/150?u=${encodeURIComponent(normalized)}`;
}
