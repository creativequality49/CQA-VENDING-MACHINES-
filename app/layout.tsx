import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Creative Quality Australia – Digital Vending Machine System",
  description: "Production-ready digital vending machine SaaS with checkout and vault access.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
