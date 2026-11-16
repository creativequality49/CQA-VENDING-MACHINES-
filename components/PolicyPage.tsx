import Link from "next/link";
import type { ReactNode } from "react";

type PolicySection = { title: string; content: ReactNode };

export function PolicyPage({ title, introduction, sections }: {
  title: string;
  introduction: string;
  sections: PolicySection[];
}) {
  return (
    <main className="container" style={{ paddingTop: "3rem", paddingBottom: "7rem", maxWidth: 900 }}>
      <header>
        <span className="eyebrow">CREATIVE QUALITY AUSTRALIA · ABN 50 752 160 542</span>
        <h1>{title}</h1>
        <p className="small" style={{ lineHeight: 1.8 }}>{introduction}</p>
      </header>
      <div style={{ display: "grid", gap: "1rem", marginTop: "2rem" }}>
        {sections.map(({ title: heading, content }) => (
          <section key={heading} className="glass-card" style={{ padding: "1.5rem" }}>
            <h2 style={{ marginTop: 0 }}>{heading}</h2>
            <div className="small" style={{ lineHeight: 1.8 }}>{content}</div>
          </section>
        ))}
      </div>
      <nav aria-label="Policies and support" style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginTop: "2rem" }}>
        <Link href="/terms">Terms of service</Link>
        <Link href="/privacy">Privacy policy</Link>
        <Link href="/refund-policy">Refunds & cancellation</Link>
        <Link href="/contact?service=support">Contact CQA</Link>
      </nav>
    </main>
  );
}
