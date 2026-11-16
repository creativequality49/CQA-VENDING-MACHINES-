/** Explicit project configuration; no implicit cross-environment database. */
export function requireCqaSupabaseUrl(value: string | undefined): string {
  if (!value || value !== value.trim()) throw new Error("CQA Supabase URL is not configured correctly.");
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) ||
        url.username || url.password || url.port || url.pathname !== "/" || url.search || url.hash) throw new Error("Invalid project URL");
    return url.origin;
  } catch {
    throw new Error("CQA Supabase URL is not configured correctly.");
  }
}
