/** Canonical production destination for Supabase email links.
 * Never redirect real customers to localhost or temporary preview domains.
 * Local development may opt into localhost only when explicitly running on localhost.
 */
export function getCqaAuthOrigin(): string {
  if (typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)) {
    return window.location.origin;
  }
  return "https://www.creativequalityaustralia.tech";
}
