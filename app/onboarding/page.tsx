"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CQA_PLANS, getBrowserSupabaseClient, type PlanKey } from "@/lib/cqa-marketplace";

function OnboardingForm() {
  const router = useRouter();
  const search = useSearchParams();
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const requestedPlan = search.get("plan");
  const initialPlan: PlanKey = requestedPlan === "pro" || requestedPlan === "elite" ? requestedPlan : "starter";
  const [userId, setUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Trades & Services");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("South Australia");
  const [phone, setPhone] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [plan, setPlan] = useState<PlanKey>(initialPlan);
  const [launchPackage, setLaunchPackage] = useState(initialPlan === "pro" && search.get("package") === "launch");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
      setBusinessEmail(data.session?.user.email ?? "");
      setChecking(false);
    });
  }, [supabase]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) return;
    setLoading(true);
    setError("");
    try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setError("Your login session expired. Please log in again.");
      setLoading(false);
      return;
    }

    const response = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, category, description, location, phone, businessEmail, plan })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.businessId) {
      setError(result.error || "Could not create the business workspace.");
      setLoading(false);
      return;
    }

    const billingResponse = await fetch("/api/cqa-billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ kind: "plan", businessId: result.businessId, plan, launchPackage: plan === "pro" && launchPackage })
    });
    const billing = await billingResponse.json().catch(() => ({}));
    if (billingResponse.ok && billing.url) {
      window.location.assign(billing.url);
      return;
    }

    if (billingResponse.status === 409 && billing.error === "This machine plan is already active.") {
      router.push("/owner/setup");
      return;
    }
    setError(billing.error || "Your workspace is saved. Retry secure checkout to activate it.");
    setLoading(false);
    } catch {
      setError("Secure checkout could not be reached. Your saved workspace can be retried.");
      setLoading(false);
    }
  }

  if (checking) return <p>Checking secure owner access…</p>;
  if (!userId) {
    return (
      <section className="glass-card" style={{ padding: "1.5rem", maxWidth: 700, margin: "0 auto" }}>
        <span className="eyebrow">OWNER ACCOUNT REQUIRED</span>
        <h1>Create or log in to your CQA owner account first.</h1>
        <p className="small">Your owner account protects your business data and ensures only you can manage your machine.</p>
        <Link href={`/login?next=${encodeURIComponent(`/onboarding?plan=${plan}${launchPackage ? "&package=launch" : ""}`)}`} className="button primary">Continue to secure login</Link>
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="glass-card" style={{ padding: "1.5rem", maxWidth: 850, margin: "0 auto", display: "grid", gap: "1rem" }}>
      <div>
        <span className="eyebrow">CQA BUSINESS ONBOARDING</span>
        <h1>Build and activate your business machine.</h1>
        <p className="small">Submit your business details, then activate the selected plan in secure Stripe Checkout. Add your first offer and connect Stripe to publish your machine.</p>
      </div>
      <label><span className="small">Business name</span><input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Example: Summit Plumbing Co." /></label>
      <label><span className="small">Business category</span><select value={category} onChange={(e) => setCategory(e.target.value)}><option>Trades & Services</option><option>Beauty</option><option>Fitness</option><option>Coaching</option><option>Professional Services</option><option>Retail</option><option>Creator</option><option>Other</option></select></label>
      <label><span className="small">What does the business provide?</span><textarea required rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your services, products and ideal customers." /></label>
      <div className="grid grid-2">
        <label><span className="small">Service area / location</span><input required value={location} onChange={(e) => setLocation(e.target.value)} /></label>
        <label><span className="small">Business phone</span><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" /></label>
      </div>
      <label><span className="small">Business contact email</span><input type="email" required value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)} /></label>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="small" style={{ marginBottom: ".6rem" }}>Machine plan</legend>
        <div className="grid grid-3">
          {CQA_PLANS.map((item) => (
            <label key={item.key} className="glass-card" style={{ padding: "1rem", cursor: "pointer", border: plan === item.key ? "1px solid #ff7bd3" : undefined }}>
              <input type="radio" name="plan" checked={plan === item.key} onChange={() => setPlan(item.key)} /> <strong>{item.name}</strong><br/>
              <span className="small">{"$"}{item.price}/month · {item.fee}% sale fee</span><br/><span className="small"><strong>{item.setupMode}</strong> · {item.automationLevel}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {plan === "pro" ? <label className="glass-card" style={{ padding: "1rem" }}>
        <input type="checkbox" checked={launchPackage} onChange={(event) => setLaunchPackage(event.target.checked)} /> <strong>Add Pro Launch Package — $997 one-time setup</strong>
        <p className="small">Branded setup, offers loaded, payment connection, automation, basic AI receptionist and launch configuration. Pro remains $297/month.</p>
      </label> : null}
      {error ? <div role="alert" style={{ padding: ".8rem 1rem", borderRadius: 10, border: "1px solid rgba(255,70,100,.4)" }}>{error}</div> : null}
      <button className="button primary" type="submit" disabled={loading} style={{ justifyContent: "center" }}>{loading ? "Creating secure checkout…" : "Create Machine & Continue to Stripe"}</button>
      <p className="small">The CQA plan is billed monthly through Stripe. The optional Pro Launch Package adds a one-time $997 setup charge to the first payment. Connect your own Stripe account before publishing and accepting customer payments.</p>
    </form>
  );
}

export default function OnboardingPage() {
  return <main className="container" style={{ paddingTop: "2.5rem", paddingBottom: "4rem" }}><Suspense fallback={<p>Loading onboarding…</p>}><OnboardingForm /></Suspense></main>;
}
