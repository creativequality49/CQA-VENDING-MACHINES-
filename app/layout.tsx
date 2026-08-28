import type { Metadata } from "next";
import "./globals.css";
import { NavBar } from "@/components/NavBar";

const siteUrl = "https://cqavmachine.live";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "CQA AI Business Automation Australia | Digital Vending Machines",
    template: "%s | CQA Digital Vending Machines",
  },
  description:
    "Creative Quality Australia provides fixed-price AI business automation systems for content, lead generation, sales follow-up, onboarding and business workflows.",
  keywords: [
    "AI business automation Australia",
    "business automation Australia",
    "AI automation systems",
    "lead generation automation",
    "sales follow-up automation",
    "content automation",
    "Creative Quality Australia",
    "CQA Digital Vending Machines",
  ],
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "CQA Digital Vending Machines",
    title: "CQA AI Business Automation Australia",
    description:
      "Fixed-price AI automation systems for Australian businesses, from content and lead generation to sales follow-up and onboarding.",
  },
  twitter: {
    card: "summary_large_image",
    title: "CQA AI Business Automation Australia",
    description:
      "Fixed-price AI automation systems for Australian businesses.",
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
