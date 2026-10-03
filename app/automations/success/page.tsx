"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function AutomationSuccessPage() {
  const search = useSearchParams();
  const offer = search.get("offer");

  return (
    <main className="container" style={{ paddingTop: "4rem", paddingBottom: "6rem" }}>
      <section className="glass-card" style={{ maxWidth: 760, margin: "0 auto", padding: "2rem" }}>
        <span className="eyebrow">PAYMENT RECEIVED</span>
        <h1>Your CQA automation purchase is confirmed.</h1>
        <p>Stripe has completed your checkout{offer ? " for " + offer.replaceAll("_", " ") : ""}. Keep the email receipt for your records.</p>
        <p className="small">Next, send CQA the business details, workflow requirements and systems you want connected so implementation can be scoped against the automation you purchased.</p>
        <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap", marginTop: "1rem" }}>
          <Link href="/contact" className="button primary">Send My Implementation Brief</Link>
          <Link href="/automations" className="button ghost">Back to Automations</Link>
          <Link href="/owner/dashboard" className="button ghost">Owner Dashboard</Link>
        </div>
      </section>
    </main>
  );
}
