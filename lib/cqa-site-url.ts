import "server-only";

const PRODUCTION_SITE_URL = "https://www.creativequalityaustralia.tech";

/** Customer-facing server links must return to the canonical production domain. */
export function getCqaSiteUrl(request?: Request): string {
  if (process.env.VERCEL_ENV === "production") return PRODUCTION_SITE_URL;
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const candidate = configured || (request ? new URL(request.url).origin : undefined);
  if (!candidate) throw new Error("Site URL unavailable.");
  const url = new URL(candidate);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("Invalid site URL configuration.");
  }
  return url.origin;
}
