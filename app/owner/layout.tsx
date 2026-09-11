import { Suspense } from "react";

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<main className="container" style={{ paddingTop: "3rem" }}><p>Loading secure owner workspace…</p></main>}>{children}</Suspense>;
}
