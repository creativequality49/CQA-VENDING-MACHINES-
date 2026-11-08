import { Analytics } from "@vercel/analytics/next";
import Link from "next/link";
import type { Metadata } from "next";
import "./globals.css";
import "./ux-release.css";
import "./cqa-reference.css";
import "./inner-pages-premium.css";
import "./vending-reference.css";
import "./studio.css";
import { NavBar } from "@/components/NavBar";

// Keep the public fallback aligned with the domain attached to the production
// Vercel project. Vercel still overrides this with NEXT_PUBLIC_SITE_URL when set.
const siteUrl = "https://www.creativequalityaustralia.tech";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "CQA Vending Marketplace | Business Machines + AI Workers",
    template: "%s | CQA Vending Marketplace",
  },
  description:
    "Creative Quality Australia gives Australian businesses branded digital vending machines inside a shared marketplace for services, bookings, products, subscriptions and AI-assisted operations.",
  keywords: [
    "digital vending marketplace Australia",
    "business vending machine",
    "online business storefront Australia",
    "AI business workers",
    "business automation marketplace",
    "Creative Quality Australia",
    "CQA Vending Marketplace",
  ],
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "CQA Vending Marketplace",
    title: "CQA Vending Marketplace",
    description: "Branded digital business machines, marketplace discovery, Stripe-connected payments and optional AI workers for Australian businesses.",
  },
  twitter: {
    card: "summary_large_image",
    title: "CQA Vending Marketplace",
    description: "Digital business machines, marketplace discovery and AI-assisted operations for Australian businesses.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-AU">
      <body>
        <NavBar />
        {children}
        <footer className="studio-footer"><div><Link href="/" className="studio-footer-brand">CQA<span style={{color:"#ff58a7"}}> / </span>AUSTRALIA</Link><p>Branded digital storefronts and AI draft workers for your next stage of business.</p><p>Creative Quality Australia<br/>ABN 50 752 160 542</p></div><div><strong>EXPLORE</strong><Link href="/machines">Machine collection</Link><Link href="/workers">AI draft workers</Link><Link href="/pricing">Plans & inclusions</Link><Link href="/login?next=/owner/dashboard">Owner workspace</Link></div><div><strong>HERE TO HELP</strong><Link href="/contact?service=support">Contact & support</Link><Link href="/terms">Terms of service</Link><Link href="/privacy">Privacy policy</Link><Link href="/refund-policy">Refund policy</Link></div></footer>
        <Analytics />
      </body>
    </html>
  );
}
