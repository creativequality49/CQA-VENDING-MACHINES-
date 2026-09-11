"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CQA_WORKERS, formatAud, getBrowserSupabaseClient } from "@/lib/cqa-marketplace";

type Business = { id: string; name: string; slug: string; category: string; plan: "starter" | "pro" | "elite"; status: string; verified: boolean };
type Machine = { id: string; slug: string; title: string; status: string };
type Offer = { id: string; name: string; offer_type: string; price_cents: number | null; active: boolean };
type Booking = { id: string; customer_name: string; customer_email: string; status: string; created_at: string; notes: string | null };
type ConnectedAccount = { stripe_account_id: string | null; onboarding_complete: boolean; charges_enabled: boolean; payouts_enabled: boolean };
type Worker = { worker_id: string; enabled: boolean };

export default function OwnerDashboardPage() {
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const search = useSearchParams();
  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [machine, setMachine] = useState<Machine | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [account, setAccount] = useState<ConnectedAccount | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [offerName, setOfferName] = useState("");
  const [offerType, setOfferType] = useState("service");
  const [price, setPrice] = useState("");
  const [offerDescription, setOfferDescription] = useState("");
  const [changeRequest, setChangeRequest] = useState("");

  async function load(ownerId: string) {
    setError("");
    const { data: businesses, error: businessError } = await supabase.from("cqa_businesses").select("id,name,slug,category,plan,status,verified").eq("owner_id", ownerId).order("created_at", { ascending: true }).limit(1);
    if (businessError) { setError(businessError.message); setChecking(false); return; }
    const first = (businesses?.[0] as Business | undefined) || null;
    setBusiness(first);
    if (!first) { setChecking(false); return; }

    const [machineResult, offerResult, bookingResult, accountResult, workerResult] = await Promise.all([
      supabase.from("cqa_machines").select("id,slug,title,status").eq("business_id", first.id).limit(1),
      supabase.from("cqa_offers").select("id,name,offer_type,price_cents,active").eq("business_id", first.id).order("sort_order"),
      supabase.from("cqa_bookings").select("id,customer_name,customer_email,status,created_at,notes").eq("business_id", first.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("cqa_connected_accounts").select("stripe_account_id,onboarding_complete,charges_enabled,payouts_enabled").eq("business_id", first.id).maybeSingle(),
      supabase.from("cqa_business_workers").select("worker_id,enabled").eq("business_id", first.id)
    ]);
    setMachine((machineResult.data?.[0] as Machine | undefined) || null);
    setOffers((offerResult.data as Offer[] | null) || []);
    setBookings((bookingResult.data as Booking[] | null) || []);
    setAccount((accountResult.data as ConnectedAccount | null) || null);
    setWorkers((workerResult.data as Worker[] | null) || []);
    setChecking(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const id = data.session?.user.id ?? null;
      setUserId(id);
      if (id) load(id); else setChecking(false);
    });
  }, [supabase]);

  useEffect(() => {
    if (search.get("created") === "1") setMessage("Your business machine has been created and submitted for CQA review.");
    if (search.get("stripe") === "return") setMessage("Stripe onboarding returned successfully. Refreshing account status may take a moment.");
  }, [search]);

  async function addOffer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!business || !machine || !userId) return;
    setError("");
    const cents = price.trim() ? Math.round(Number(price) * 100) : null;
    if (cents !== null && (!Number.isFinite(cents) || cents < 0)) { setError("Enter a valid price."); return; }
    const { error: insertError } = await supabase.from("cqa_offers").insert({ business_id: business.id, machine_id: machine.id, name: offerName.trim(), description: offerDescription.trim() || null, offer_type: offerType, price_cents: cents, currency: "aud", active: true });
    if (insertError) { setError(insertError.message); return; }
    setOfferName(""); setOfferDescription(""); setPrice("");
    setMessage("Offer added to your machine workspace.");
    await load(userId);
  }

  async function addWorker(workerId: string) {
    if (!business || !userId) return;
    const { error: workerError } = await supabase.from("cqa_business_workers").upsert({ business_id: business.id, worker_id: workerId, enabled: true }, { onConflict: "business_id,worker_id" });
    if (workerError) { setError(workerError.message); return; }
    setMessage("AI worker added to your business workspace.");
    await load(userId);
  }

  async function requestChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!business || !userId || !changeRequest.trim()) return;
    const { error: requestError } = await supabase.from("cqa_change_requests").insert({ business_id: business.id, requested_by: userId, request_type: "owner_request", payload: { request: changeRequest.trim() }, sensitive: false, status: "pending" });
    if (requestError) { setError(requestError.message); return; }
    setChangeRequest(""); setMessage("Change request sent to CQA for review.");
  }

  async function connectStripe() {
    if (!business) return;
    setError("");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) { setError("Please log in again before connecting Stripe."); return; }
    const response = await fetch("/api/marketplace/connect", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ businessId: business.id }) });
    const result = (await response.json()) as { url?: string; error?: string };
    if (!response.ok || !result.url) { setError(result.error || "Unable to start Stripe onboarding."); return; }
    window.location.assign(result.url);
  }

  async function logout() { await supabase.auth.signOut(); window.location.assign("/"); }

  if (checking) return <main className="container" style={{ paddingTop: "3rem" }}><p>Loading your secure CQA workspace…</p></main>;
  if (!userId) return <main className="container" style={{ paddingTop: "3rem", paddingBottom: "4rem" }}><section className="glass-card" style={{ padding: "1.5rem" }}><span className="eyebrow">OWNER LOGIN REQUIRED</span><h1>Your business workspace is protected.</h1><Link href="/login?next=/owner/dashboard" className="button primary">Log in to Owner Dashboard</Link></section></main>;
  if (!business) return <main className="container" style={{ paddingTop: "3rem", paddingBottom: "4rem" }}><section className="glass-card" style={{ padding: "1.5rem" }}><span className="eyebrow">NO MACHINE YET</span><h1>Create your first CQA business machine.</h1><p className="small">Your account is active, but no business is connected to it yet.</p><Link href="/onboarding" className="button primary">Start Business Onboarding</Link></section></main>;

  const enabledWorkerIds = new Set(workers.filter((worker) => worker.enabled).map((worker) => worker.worker_id));
  return (
    <main className="container" style={{ paddingTop: "2rem", paddingBottom: "4rem" }}>
      <section className="glass-card" style={{ padding: "1.5rem", marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}><div><span className="eyebrow">CQA OWNER WORKSPACE</span><h1 style={{ marginBottom: ".4rem" }}>{business.name}</h1><p className="small">{business.category} · {business.plan.toUpperCase()} · Machine status: <strong>{machine?.status || business.status}</strong></p></div><button className="button ghost" type="button" onClick={logout}>Log out</button></div>
        {message ? <div role="status" style={{ marginTop: "1rem", padding: ".75rem", border: "1px solid rgba(80,255,180,.35)", borderRadius: 10 }}>{message}</div> : null}
        {error ? <div role="alert" style={{ marginTop: "1rem", padding: ".75rem", border: "1px solid rgba(255,70,100,.4)", borderRadius: 10 }}>{error}</div> : null}
      </section>

      <section className="grid grid-3" style={{ marginBottom: "1rem" }}>
        <article className="glass-card" style={{ padding: "1rem" }}><span className="eyebrow">OFFERS</span><h2>{offers.length}</h2><p className="small">Products, services and bookings configured.</p></article>
        <article className="glass-card" style={{ padding: "1rem" }}><span className="eyebrow">LEADS / BOOKINGS</span><h2>{bookings.length}</h2><p className="small">Most recent requests visible below.</p></article>
        <article className="glass-card" style={{ padding: "1rem" }}><span className="eyebrow">AI WORKERS</span><h2>{enabledWorkerIds.size}</h2><p className="small">Operational workers enabled.</p></article>
      </section>

      <section className="glass-card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
        <span className="eyebrow">PAYMENTS</span><h2>Stripe Connect</h2>
        <p className="small">{account?.onboarding_complete && account.charges_enabled ? "Your connected account is ready to accept eligible machine payments." : "Connect the business’s own Stripe account before CQA publishes paid offers."}</p>
        <div style={{ display: "flex", gap: ".7rem", flexWrap: "wrap" }}><button className="button primary" type="button" onClick={connectStripe}>{account?.stripe_account_id ? "Continue / Review Stripe Setup" : "Connect Business Stripe"}</button>{machine?.status === "live" ? <Link className="button ghost" href={`/machine/${machine.slug}`}>View Live Machine</Link> : null}</div>
      </section>

      <section className="grid grid-2" style={{ marginBottom: "1rem" }}>
        <form onSubmit={addOffer} className="glass-card" style={{ padding: "1.25rem", display: "grid", gap: ".8rem" }}><span className="eyebrow">MACHINE OFFERS</span><h2>Add an offer</h2><input required placeholder="Offer name" value={offerName} onChange={(e) => setOfferName(e.target.value)} /><textarea rows={3} placeholder="Description" value={offerDescription} onChange={(e) => setOfferDescription(e.target.value)} /><div className="grid grid-2"><select value={offerType} onChange={(e) => setOfferType(e.target.value)}><option value="service">Service</option><option value="booking">Booking</option><option value="quote">Quote</option><option value="consultation">Consultation</option><option value="physical_product">Physical product</option><option value="digital_product">Digital product</option><option value="subscription">Subscription</option></select><input type="number" min="0" step="0.01" placeholder="AUD price (optional)" value={price} onChange={(e) => setPrice(e.target.value)} /></div><button className="button primary" type="submit">Add Offer</button></form>
        <form onSubmit={requestChange} className="glass-card" style={{ padding: "1.25rem", display: "grid", gap: ".8rem" }}><span className="eyebrow">CONVERSATIONAL CHANGES</span><h2>Ask CQA to change your machine</h2><p className="small">Describe the change in normal language. The request is stored for review before sensitive changes are applied.</p><textarea required rows={6} placeholder="Example: Add an emergency call-out service and move it to the first slot." value={changeRequest} onChange={(e) => setChangeRequest(e.target.value)} /><button className="button primary" type="submit">Send Change Request</button></form>
      </section>

      <section className="glass-card" style={{ padding: "1.25rem", marginBottom: "1rem" }}><span className="eyebrow">CURRENT OFFERS</span><h2>Your machine inventory</h2>{offers.length ? <div className="revenue-stack">{offers.map((offer) => <div key={offer.id}><span>{offer.active ? "ON" : "OFF"}</span><strong>{offer.name}</strong><small>{offer.offer_type.replaceAll("_", " ")} · {formatAud(offer.price_cents)}</small></div>)}</div> : <p className="small">No offers yet. Add your first service or product above.</p>}</section>

      <section className="glass-card" style={{ padding: "1.25rem", marginBottom: "1rem" }}><span className="eyebrow">AI WORKER STORE</span><h2>Expand your machine</h2><div className="grid grid-2">{CQA_WORKERS.map(([id, name, price, description]) => <article key={id} className="glass-card" style={{ padding: "1rem" }}><h3>{name}</h3><p className="small">{description}</p><strong>${price} AUD/month</strong><div style={{ marginTop: ".7rem" }}><button type="button" className={enabledWorkerIds.has(id) ? "button ghost" : "button primary"} disabled={enabledWorkerIds.has(id)} onClick={() => addWorker(id)}>{enabledWorkerIds.has(id) ? "Added" : "Add Worker"}</button></div></article>)}</div></section>

      <section className="glass-card" style={{ padding: "1.25rem" }}><span className="eyebrow">LATEST CUSTOMER REQUESTS</span><h2>Bookings and enquiries</h2>{bookings.length ? <div className="revenue-stack">{bookings.map((booking) => <div key={booking.id}><span>{booking.status.toUpperCase()}</span><strong>{booking.customer_name}</strong><small>{booking.customer_email} · {new Date(booking.created_at).toLocaleDateString("en-AU")}{booking.notes ? ` · ${booking.notes.slice(0, 90)}` : ""}</small></div>)}</div> : <p className="small">No customer requests yet.</p>}</section>
    </main>
  );
}
