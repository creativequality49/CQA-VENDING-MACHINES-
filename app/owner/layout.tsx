import Link from "next/link";
import { Suspense } from "react";

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<main className="container" style={{ paddingTop: "3rem" }}><p>Loading secure owner workspace…</p></main>}>
      <div className="container owner-workspace-shell">
        <nav className="owner-workspace-nav" aria-label="Owner workspace">
          <Link href="/owner/dashboard" className="owner-workspace-brand">
            <span>CQΛ</span>
            <div><strong>OWNER OS</strong><small>Business machine control</small></div>
          </Link>
          <div className="owner-workspace-links">
            <Link href="/owner/dashboard">Dashboard</Link>
            <Link href="/owner/setup">Machine Builder</Link>
            <Link href="/owner/integrations">Connections</Link>
            <Link href="/owner/automations">Automations</Link>
            <Link href="/marketplace">Marketplace</Link>
          </div>
          <span className="owner-workspace-live"><i /> SYSTEM ONLINE</span>
        </nav>
      </div>
      {children}
    </Suspense>
  );
}
