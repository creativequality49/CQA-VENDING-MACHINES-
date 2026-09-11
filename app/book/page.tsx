"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function BookingForm() {
  const search = useSearchParams();
  const machine = search.get("machine") || "";
  const offer = search.get("offer") || "general";
  const demo = search.get("demo") === "1" || machine.startsWith("demo-");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [requestedAt, setRequestedAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    if (demo) {
      setTimeout(() => { setSuccess(true); setLoading(false); }, 250);
      return;
    }
    try {
      const response = await fetch("/api/marketplace/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machineSlug: machine, offerId: offer, customerName: name, customerEmail: email, customerPhone: phone || undefined, notes: notes || undefined, requestedAt: requestedAt || undefined })
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to submit your request");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit your request");
    } finally {
      setLoading(false);
    }
  }

  if (!machine) return <section className="glass-card" style={{ padding: "1.5rem" }}><h1>Machine not selected</h1><Link href="/marketplace" className="button primary">Return to marketplace</Link></section>;
  if (success) return <section className="glass-card" style={{ padding: "1.5rem", maxWidth: 680, margin: "0 auto" }}><span className="eyebrow">REQUEST RECEIVED</span><h1>{demo ? "Demo request completed." : "Your request has been sent."}</h1><p className="small">{demo ? "This demonstration did not contact a real business or create a live booking." : "The business owner can now review your enquiry from their CQA workspace."}</p><Link href={`/machine/${machine}`} className="button primary">Back to machine</Link></section>;

  return (
    <form onSubmit={submit} className="glass-card" style={{ padding: "1.5rem", maxWidth: 720, margin: "0 auto", display: "grid", gap: "1rem" }}>
      <div><span className="eyebrow">{demo ? "CQA DEMO REQUEST" : "SECURE BUSINESS REQUEST"}</span><h1>Book, enquire or request a quote.</h1><p className="small">Send the business the information it needs to review your request. No payment is taken on this form.</p></div>
      <label><span className="small">Your name</span><input required value={name} onChange={(e) => setName(e.target.value)} /></label>
      <div className="grid grid-2"><label><span className="small">Email</span><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label><label><span className="small">Phone</span><input value={phone} onChange={(e) => setPhone(e.target.value)} /></label></div>
      <label><span className="small">Preferred date/time (optional)</span><input type="datetime-local" value={requestedAt} onChange={(e) => setRequestedAt(e.target.value)} /></label>
      <label><span className="small">What do you need?</span><textarea required rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Job details, questions, quote requirements or anything the business should know." /></label>
      {error ? <div role="alert" style={{ padding: ".8rem 1rem", border: "1px solid rgba(255,70,100,.4)", borderRadius: 10 }}>{error}</div> : null}
      <button className="button primary" type="submit" disabled={loading} style={{ justifyContent: "center" }}>{loading ? "Sending…" : demo ? "Complete Demo Request" : "Send Request"}</button>
      <Link href={`/machine/${machine}`} className="text-link">← Cancel and return to machine</Link>
    </form>
  );
}

export default function BookPage() {
  return <main className="container" style={{ paddingTop: "2.5rem", paddingBottom: "4rem" }}><Suspense fallback={<p>Loading request form…</p>}><BookingForm /></Suspense></main>;
}
