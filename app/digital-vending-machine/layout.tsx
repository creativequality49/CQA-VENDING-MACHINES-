import type { Metadata } from "next";
import type { ReactNode } from "react";
export const metadata: Metadata = {
  title: "CQA Digital Vending Machine",
  description: "Explore CQA's interactive digital vending machine concept, then browse digital kits, services or build your own storefront preview.",
};
export default function DigitalMachineLayout({ children }: { children: ReactNode }) { return children; }
