const productionOrigin = "https://www.creativequalityaustralia.tech";
const previewHostname = /^cqa-vending-machines-[a-z0-9-]+-creativequality\.vercel\.app$/;

/** Keep sandbox email credentials on the exact configured isolated Preview. */
export function getCqaAuthOrigin(): string {
  if (typeof window === "undefined") return productionOrigin;
  const current = new URL(window.location.origin);
  if (["localhost", "127.0.0.1"].includes(current.hostname) && ["http:", "https:"].includes(current.protocol)) return current.origin;
  if (current.hostname.endsWith(".vercel.app") || process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("ndzmlywsuywkhgqdbzft")) {
    const configured = process.env.NEXT_PUBLIC_SITE_URL;
    // Vercel provides this build-time value before the immutable URL is known
    // to operators; do not trust an arbitrary runtime Host header.
    const deploymentHost = process.env.NEXT_PUBLIC_VERCEL_URL;
    const database = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (previewHostname.test(current.hostname) && current.protocol === "https:" && !current.port && (configured === current.origin || deploymentHost === current.host) &&
        ["https://ndzmlywsuywkhgqdbzft.supabase.co", "https://ndzmlywsuywkhgqdbzft.supabase.co/"].includes(database || "")) return current.origin;
    throw new Error("Email access is unavailable until this test deployment is configured correctly.");
  }
  return productionOrigin;
}
