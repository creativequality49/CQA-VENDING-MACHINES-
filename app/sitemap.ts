import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.creativequalityaustralia.tech";
  const now = new Date();

  return [
    { url: baseUrl, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/machines`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/lead-machine`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/launch-machine`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/quiz`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
  ];
}
