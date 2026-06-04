import type { Metadata } from "next";
import "./globals.css";
import { NavBar } from "@/components/NavBar";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "CQA Digital Vending Machines",
  description: "Creative Quality Australia premium AI vending machine storefront.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <NavBar />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
