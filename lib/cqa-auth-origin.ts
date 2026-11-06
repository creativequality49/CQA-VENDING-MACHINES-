/** Canonical destination for Supabase email links. Never send customers to localhost or a temporary preview URL. */
export function getCqaAuthOrigin(): string {
  if (typeof window !== "undefined" && /^(localhost|127\\.0\\.0\\.1)$/.test(window.location.hostname)) {
    return window.location.origin;
  }
  return "https://www.creativequalityaustralia.tech";
}
