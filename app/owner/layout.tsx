import Link from "next/link";
import { Suspense } from "react";

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<main className="container" style={{ paddingTop: "3rem" }}><p>Loading secure owner workspace…</p></main>}>
      <div className="container" style={{ paddingTop: "1rem" }}>
        <nav className="glass-card" aria-label="Owner workspace" style={{ padding: ".7rem .9rem", display: "flex", gap: ".6rem", alignItems: "center", flexWrap: "wrap" }}>
          <strong style={{ marginRight: "auto" }}>CQA Owner Workspace</strong>
          <Link className="button ghost" href="/owner/dashboard">Dashboard</Link>
          <Link className="button ghost" href="/owner/automations">Automations</Link>
          <Link className="button ghost" href="/machines">Marketplace</Link>
        </nav>
      </div>
      {children}
    </Suspense>
  );
}
