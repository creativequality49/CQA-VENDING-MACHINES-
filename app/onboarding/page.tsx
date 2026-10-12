"use client";

import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";
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
  const [submissionMode, setSubmissionMode] = useState<"activate" | "draft">("activate");
  const busy = useRef(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) throw sessionError;
      setUserId(data.session?.user.id ?? null);
      setBusinessEmail(data.session?.user.email ?? "");
    }).catch(() => {
      if (active) setError("Owner access could not be checked. Please log in again.");
    }).finally(() => {
      if (active) setChecking(false);
    });
    return () => { active = false; };
  }, [supabase]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || busy.current) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const saveDraft = submitter instanceof HTMLButtonElement && submitter.value === "draft";
    busy.current = true;
    setSubmissionMode(saveDraft ? "draft" : "activate");
    setLoading(true);
    setError("");
    let workspaceSaved = false;
    try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setError("Your login session expired. Please log in again.");
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
      return;
    }
    workspaceSaved = true;
    if (saveDraft) {
      router.push("/owner/dashboard");
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
    } catch {
      setError(workspaceSaved ? "Your workspace is saved. Secure checkout could not be reached; you can retry activation." : "Your workspace could not be saved. Please check your connection and try again.");
    } finally {
      busy.current = false;
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
        {error ? <p role="alert">{error}</p> : null}
        <Link href={`/login?next=${encodeURIComponent(`/onboarding?plan=${plan}${launchPackage ? "&package=launch" : ""}`)}`} className="button primary">Continue to secure login</Link>
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="glass-card" style={{ padding: "1.5rem", maxWidth: 850, margin: "0 auto", display: "grid", gap: "1rem" }}>
      <div>
        <span className="eyebrow">CQA BUSINESS ONBOARDING</span>
        <h1>Build your business machine.</h1>
        <p className="small">Save a draft to explore your workspace, or activate the selected plan in secure Stripe Checkout. Add your first offer and connect Stripe to publish your machine.</p>
      </div>
      <label><span className="small">Business name</span><input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Example: Summit Plumbing Co." /></label>
      <label><span className="small">Business category</span><select aria-describedby="category-help" style={{ colorScheme: "dark", backgroundColor: "#16111e", color: "#fff" }} value={category} onChange={(e) => setCategory(e.target.value)}><option>Trades & Services</option><option>Beauty</option><option>Fitness</option><option>Coaching</option><option>Professional Services</option><option>Retail</option><option>Creator</option><option>Other</option></select><span id="category-help" className="small">Open the category dropdown to choose from 8 business categories.</span></label>
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
        <p className="small">Branded setup, offers loaded, payment connection, automation, receptionist and sales follow-up drafts, and launch configuration. Pro remains $297/month.</p>
      </label> : null}
      {error ? <div role="alert" style={{ padding: ".8rem 1rem", borderRadius: 10, border: "1px solid rgba(255,70,100,.4)" }}>{error}</div> : null}
      <button className="button primary" type="submit" name="action" value="activate" disabled={loading} style={{ justifyContent: "center" }}>{loading && submissionMode === "activate" ? "Creating secure checkout…" : "Create Machine & Continue to Stripe"}</button>
      <button className="button ghost" type="submit" name="action" value="draft" disabled={loading} style={{ justifyContent: "center" }}>{loading && submissionMode === "draft" ? "Saving your draft…" : "Save draft & preview workspace"}</button>
      <p className="small">Saving a draft opens your owner dashboard, business setup and private machine preview without starting checkout. A paid subscription is required to publish and use paid operations. Saving a draft does not activate the selected plan or purchase the Launch Package.</p>
      <p className="small">The CQA plan is billed monthly through Stripe. The optional Pro Launch Package adds a one-time $997 setup charge to the first payment. Connect your own Stripe account before publishing and accepting customer payments.</p>
    </form>
  );
}

export default function OnboardingPage() {
  return <main className="container" style={{ paddingTop: "2.5rem", paddingBottom: "4rem" }}><Suspense fallback={<p>Loading onboarding…</p>}><OnboardingForm /></Suspense></main>;
}
