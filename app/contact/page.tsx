"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function ContactForm() {
  const search = useSearchParams();
  const service = search.get("service") || "general";
  const price = search.get("price") || "";
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        phone: form.get("phone"),
        businessName: form.get("businessName"),
        message: form.get("message"),
        service,
        price
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(result.error || "Your enquiry could not be sent.");
      setStatus("idle");
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <section className="glass-card" style={{ padding: "1.5rem", maxWidth: 760, margin: "0 auto" }}>
        <span className="eyebrow">ENQUIRY RECEIVED</span>
        <h1>Your CQA request is saved.</h1>
        <p className="small">Your request has been recorded for CQA to review. You can continue exploring machine options in the meantime.</p>
        <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap" }}>
          <Link href="/machines" className="button primary">View CQA Solutions</Link>
          <Link href="/pricing" className="button ghost">Compare Plans</Link>
        </div>
      </section>
    );
  }

  const isSupport = service === "support";
  const label = isSupport ? "Customer Support" : service === "premium-setup" ? "Premium Setup & Automations" : service === "ai-readiness-audit" ? "AI Readiness Audit" : service.replaceAll("-", " ");
  return (
    <div className="grid grid-2" style={{ alignItems: "start" }}>
      <section>
        <span className="eyebrow">CQA SALES & IMPLEMENTATION</span>
        <h1>{isSupport ? "How can CQA help you?" : "Get expert help building your automation."}</h1>
        <p className="small" style={{ maxWidth: 650 }}>
          {isSupport ? "Send a support request about your account, machine or subscription. Include your machine name if applicable. Your request is recorded for follow-up." : "Request done-for-you machine setup, custom automations, AI workers or an AI-readiness audit. Your enquiry is stored in the CQA sales pipeline. Want to build your own machine? Use the free preview instead."}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: ".75rem", marginTop: "1rem" }}><Link href="/pricing" className="button primary">Build My Machine</Link><Link href="/onboarding" className="button ghost">Try Free Preview</Link></div>
        {!isSupport ? <div className="revenue-stack" style={{ marginTop: "1.25rem" }}>
          <div><span>01</span><strong>Describe the bottleneck</strong><small>What is manual, slow or costing revenue?</small></div>
          <div><span>02</span><strong>CQA maps the system</strong><small>Machine, automation, worker or custom implementation.</small></div>
          <div><span>03</span><strong>Build and launch</strong><small>Connect payments, customer flow and operational automation.</small></div>
        </div> : null}
      </section>

      <form onSubmit={submit} className="glass-card" style={{ padding: "1.4rem", display: "grid", gap: ".8rem" }}>
        <span className="eyebrow">{label.toUpperCase()}</span>
        <h2 style={{ marginTop: 0 }}>Start your request{price ? ` · $${price} AUD` : ""}</h2>
        <input name="name" required placeholder="Your name" />
        <input name="email" type="email" required placeholder="Email" />
        <div className="grid grid-2">
          <input name="phone" placeholder="Phone (optional)" />
          <input name="businessName" placeholder="Business name (optional)" />
        </div>
        <textarea name="message" required rows={7} placeholder={isSupport ? "Describe your issue and the machine or account affected. Do not include passwords or payment card details." : "What would you like CQA to build or automate?"} />
        {error ? <div role="alert" style={{ padding: ".75rem", border: "1px solid rgba(255,70,100,.4)", borderRadius: 10 }}>{error}</div> : null}
        <button type="submit" className="button primary" disabled={status === "sending"} style={{ justifyContent: "center" }}>
          {status === "sending" ? "Saving request…" : "Send to CQA"}
        </button>
        <p className="small" style={{ margin: 0 }}>No payment is taken from this form.</p>
      </form>
    </div>
  );
}

export default function ContactPage() {
  return (
    <main className="container" style={{ paddingTop: "3rem", paddingBottom: "5rem" }}>
      <Suspense fallback={<p>Loading CQA contact form…</p>}><ContactForm /></Suspense>
    </main>
  );
}
