"use client";

import { FormEvent, Suspense, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function ContactForm() {
  const search = useSearchParams();
  const service = search.get("service") || "general";
  const price = search.get("price") || "";
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const implementation = service === "automation-implementation";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setStatus("sending");
    setError("");
    try {
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
      if (!response.ok || result.ok !== true) throw new Error(result.error || "Your enquiry could not be confirmed. Please try again.");
      setStatus("sent");
    } catch (failure) {
      setError(failure instanceof TypeError ? "We could not reach CQA. Check your connection and try again." : failure instanceof Error ? failure.message : "Your enquiry could not be saved. Please try again.");
      setStatus("idle");
    } finally { inFlight.current = false; }
  }

  if (status === "sent") {
    return (
      <section className="glass-card" style={{ padding: "1.5rem", maxWidth: 760, margin: "0 auto" }}>
        <span className="eyebrow">ENQUIRY RECEIVED</span>
        <h1>Your CQA request is saved.</h1>
        <p className="small">Your details have been added to the CQA sales pipeline. You can continue exploring the machine options while the request is reviewed.</p>
        <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap" }}>
          <Link href="/machines" className="button primary">View CQA Solutions</Link>
          <Link href="/pricing" className="button ghost">Compare Plans</Link>
        </div>
      </section>
    );
  }

  const label = service === "ai-readiness-audit" ? "AI Readiness Audit" : service.replaceAll("-", " ");
  return (
    <div className="grid grid-2" style={{ alignItems: "start" }}>
      <section>
        <span className="eyebrow">CQA SALES & IMPLEMENTATION</span>
        <h1>{implementation ? "Send your automation implementation brief." : "Tell CQA what you want to automate or sell."}</h1>
        <p className="small" style={{ maxWidth: 650 }}>
          Use this form for a business machine, automation build, AI worker setup or AI-readiness audit. Your enquiry is stored directly in the CQA sales pipeline.
        </p>
        {implementation ? <p className="small">Include your package or worker name, receipt reference, the workflow you need and the tools you use. Do not send passwords, API keys or payment-card details.</p> : null}
        <div className="revenue-stack" style={{ marginTop: "1.25rem" }}>
          <div><span>01</span><strong>Describe the bottleneck</strong><small>What is manual, slow or costing revenue?</small></div>
          <div><span>02</span><strong>CQA maps the system</strong><small>Machine, automation, worker or custom implementation.</small></div>
          <div><span>03</span><strong>Build and launch</strong><small>Connect payments, customer flow and operational automation.</small></div>
        </div>
      </section>

      <form onSubmit={submit} className="glass-card" style={{ padding: "1.4rem", display: "grid", gap: ".8rem" }}>
        <span className="eyebrow">{label.toUpperCase()}</span>
        <h2 style={{ marginTop: 0 }}>Start your request{price ? ` · $${price} AUD` : ""}</h2>
        <input name="name" required placeholder="Your name" aria-label="Your name" autoComplete="name" />
        <input name="email" type="email" required placeholder="Email" aria-label="Email address" autoComplete="email" />
        <div className="grid grid-2">
          <input name="phone" placeholder="Phone (optional)" aria-label="Phone (optional)" autoComplete="tel" />
          <input name="businessName" placeholder="Business name (optional)" aria-label="Business name (optional)" autoComplete="organization" />
        </div>
        <textarea name="message" required rows={7} aria-label={implementation ? "Implementation brief" : "Project requirements"} placeholder={implementation ? "Package or worker purchased:\nReceipt reference:\nDesired business outcome:\nCurrent workflow:\nTools to connect:" : "What do you want CQA to build, automate, improve or sell for you?"} />
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
