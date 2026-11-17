const fallback = "/fanxfantasy";
const origin = "https://cqa-return-path.invalid";

/** Keep age-assurance navigation on this application, including on localhost. */
export function safeAgeReturnPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || /[\\\u0000-\u0020\u007f]/.test(value)) return fallback;
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || decoded.includes("\\")) return fallback;
    const url = new URL(value, origin);
    return url.origin === origin && !url.pathname.startsWith("//")
      ? `${url.pathname}${url.search}${url.hash}`
      : fallback;
  } catch {
    return fallback;
  }
}
