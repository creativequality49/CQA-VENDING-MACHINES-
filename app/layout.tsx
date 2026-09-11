import type { Metadata } from "next";
import "./globals.css";
import "./ux-release.css";
import { NavBar } from "@/components/NavBar";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.cqavmachine.live";

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
      </body>
    </html>
  );
}
