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
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const requestUrl = request ? new URL(request.url) : undefined;
  const localRequest = requestUrl && ["localhost", "127.0.0.1", "[::1]"].includes(requestUrl.hostname);
  // A hosted callback/receipt must never send customers to their own device.
  if (local && ((requestUrl && !localRequest) || ["preview", "production"].includes(process.env.VERCEL_ENV || "")))
    throw new Error("Hosted site URL cannot use localhost.");
  if (!local && url.protocol !== "https:") throw new Error("Hosted site URL must use HTTPS.");
  return url.origin;
}
