"use client";

import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CQA_PLANS, getBrowserSupabaseClient, type PlanKey } from "@/lib/cqa-marketplace";
import CqaMachinePreview, { type PreviewOffer } from "@/components/CqaMachinePreview";

const STORAGE = "cqa-onboarding-preview-v1";
const PREVIEW_LIFETIME_MS = 24 * 60 * 60 * 1000;
function OnboardingForm() {
  const router = useRouter(); const search = useSearchParams();
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const requestedPlan = search.get("plan");
  const initialPlan: PlanKey = requestedPlan === "pro" || requestedPlan === "elite" ? requestedPlan : "starter";
  const [userId, setUserId] = useState<string | null>(null); const [checking, setChecking] = useState(true);
  const [name, setName] = useState(""); const [category, setCategory] = useState("Trades & Services");
  const [description, setDescription] = useState(""); const [location, setLocation] = useState("South Australia");
  const [phone, setPhone] = useState(""); const [businessEmail, setBusinessEmail] = useState("");
  const [plan, setPlan] = useState<PlanKey>(initialPlan);
  const [launchPackage, setLaunchPackage] = useState(initialPlan === "pro" && search.get("package") === "launch");
  const [offers, setOffers] = useState<PreviewOffer[]>([{ name: "", price: "" }]);
  const [colour, setColour] = useState("#ff7bd3"); const [reviewed, setReviewed] = useState(false);
  const [restored, setRestored] = useState(false); const [usingExample, setUsingExample] = useState(false);
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const [submissionMode, setSubmissionMode] = useState<"activate" | "draft">("activate");
  const busy = useRef(false); const previewRef = useRef<HTMLElement>(null);
  const chosenPlan = CQA_PLANS.find((item) => item.key === plan)!;
  const reviewPreview = () => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  useEffect(() => {
    try {
      let saved = null;
      for (const storageName of ["sessionStorage", "localStorage"] as const) {
        try {
          const storage = window[storageName];
          const candidate = JSON.parse(storage.getItem(STORAGE) || "null");
          if (candidate?.version === 2 && typeof candidate.expiresAt === "number" && candidate.expiresAt > Date.now() && candidate.expiresAt <= Date.now() + PREVIEW_LIFETIME_MS + 60_000) {
            if (!saved) saved = candidate;
            continue;
          }
          if (candidate) storage.removeItem(STORAGE);
        } catch { /* Try the other storage if this one is unavailable. */ }
      }
      if (saved) {
        if (typeof saved.name === "string") setName(saved.name.slice(0, 120));
        if (typeof saved.category === "string") setCategory(saved.category.slice(0, 80));
        if (typeof saved.description === "string") setDescription(saved.description.slice(0, 2000));
        if (typeof saved.location === "string") setLocation(saved.location.slice(0, 160));
        if (typeof saved.colour === "string" && /^#[0-9a-f]{6}$/i.test(saved.colour)) setColour(saved.colour);
        if (Array.isArray(saved.offers)) {
          const safeOffers = saved.offers.slice(0, 3).filter((offer: PreviewOffer) => offer && typeof offer.name === "string" && typeof offer.price === "string").map((offer: PreviewOffer) => ({ name: offer.name.slice(0, 120), price: offer.price.slice(0, 12) }));
          if (safeOffers.length) setOffers(safeOffers);
        }
        setUsingExample(saved.usingExample === true);
        if (!requestedPlan && ["starter", "pro", "elite"].includes(saved.plan)) setPlan(saved.plan);
        if (!requestedPlan && saved.plan === "pro") setLaunchPackage(saved.launchPackage === true);
      }
    } catch { /* Preview remains usable if storage is unavailable. */ }
    setRestored(true);
  }, [requestedPlan]);
  useEffect(() => {
    if (!restored) return;
    const draft = JSON.stringify({ version: 2, expiresAt: Date.now() + PREVIEW_LIFETIME_MS, name, category, description, location, offers, colour, plan, launchPackage, usingExample });
    try { sessionStorage.setItem(STORAGE, draft); } catch { /* Keep the in-memory draft usable. */ }
    try { localStorage.setItem(STORAGE, draft); } catch { /* Session storage may still preserve the draft. */ }
    setReviewed(false);
  }, [restored, name, category, description, location, offers, colour, plan, launchPackage, usingExample]);
  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return; if (sessionError) throw sessionError;
      setUserId(data.session?.user.id ?? null); setBusinessEmail(data.session?.user.email ?? "");
    }).catch(() => { if (active) setError("Owner access could not be checked. Please log in again."); }).finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [supabase]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy.current) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const saveDraft = submitter instanceof HTMLButtonElement && submitter.value === "draft";
    if (usingExample && name.trim() === "Example Studio") { setError("Replace the sample business name with your own before saving or continuing. Trying the example preview is free."); return; }
    if (!saveDraft && !reviewed) { setError("Review your personalised template and confirm it below before continuing."); reviewPreview(); return; }
    if (!userId) { router.push(`/login?next=${encodeURIComponent(`/onboarding?plan=${plan}${plan === "pro" && launchPackage ? "&package=launch" : ""}`)}`); return; }
    busy.current = true; setSubmissionMode(saveDraft ? "draft" : "activate"); setLoading(true); setError("");
    let workspaceSaved = false;
    try {
      const { data: sessionData } = await supabase.auth.getSession(); const token = sessionData.session?.access_token;
      if (!token) { setError("Your login session expired. Please log in again."); return; }
      const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
      const response = await fetch("/api/onboarding", { method: "POST", headers, body: JSON.stringify({ name, category, description, location, phone, businessEmail, plan }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.businessId) { setError(result.error || "Could not create the business workspace."); return; }
      workspaceSaved = true;
      const setupResponse = await fetch(`/api/owner/setup?businessId=${encodeURIComponent(result.businessId)}`, { headers });
      const currentSetup = await setupResponse.json().catch(() => ({}));
      if (!setupResponse.ok) throw new Error("Setup could not be checked");
      const catalogBrief = offers.filter((offer) => offer.name.trim()).map((offer) => `${offer.name.trim()}${offer.price.trim() ? ` — AUD ${offer.price}` : " — price to be confirmed"}`).join("\n");
      const businessMatches = currentSetup.business?.name === name.trim()
        && currentSetup.business?.category === category.trim()
        && currentSetup.business?.location_text === location.trim()
        && currentSetup.business?.description === description.trim();
      const savedPreviewMatches = businessMatches && currentSetup.setup?.business_summary === description.trim()
        && currentSetup.setup?.primary_color === colour
        && currentSetup.setup?.answers?.catalogBrief === catalogBrief;
      // Existing setup is never overwritten. An identical saved preview can retry checkout.
      if (result.existing && (!businessMatches || (currentSetup.setup && !savedPreviewMatches))) { setError("You already have a workspace with different saved details. Open your existing setup below to review or change those details before activating; this example has not replaced them."); return; }
      if (!currentSetup.setup) {
        const setupSave = await fetch("/api/owner/setup", { method: "POST", headers, body: JSON.stringify({ businessId: result.businessId, setupMode: plan === "starter" ? "shell" : "guided", businessSummary: description, primaryColor: colour, answers: { catalogBrief }, completedSteps: ["business", "preview"] }) });
        if (!setupSave.ok) { setError("Your workspace is saved, but the preview brief could not be saved. Please retry before checkout."); return; }
      }
      if (saveDraft) { router.push("/owner/dashboard"); return; }
      const billingResponse = await fetch("/api/cqa-billing/checkout", { method: "POST", headers, body: JSON.stringify({ kind: "plan", businessId: result.businessId, plan, launchPackage: plan === "pro" && launchPackage }) });
      const billing = await billingResponse.json().catch(() => ({}));
      if (billingResponse.ok && billing.url) { window.location.assign(billing.url); return; }
      if (billingResponse.status === 409 && billing.error === "This machine plan is already active.") { router.push("/owner/setup"); return; }
      setError(billing.error || "Your workspace is saved. Retry secure checkout to activate it.");
    } catch { setError(workspaceSaved ? "Your workspace is saved. Setup or secure checkout could not be reached; you can retry activation." : "Your workspace could not be saved. Please check your connection and try again."); }
    finally { busy.current = false; setLoading(false); }
  }
  return <form onSubmit={submit} className="glass-card" style={{ padding: "1.5rem", maxWidth: 850, margin: "0 auto", display: "grid", gap: "1rem" }}>
    <div><span className="eyebrow">DESIGN FIRST · NO PAYMENT REQUIRED</span><h1>See your business machine before you pay.</h1><p className="small">Make this template your own, review how your business and offers could look, then choose whether to continue. No login or card is needed to try the preview.</p><p className="small"><a href="#edit-preview">Personalise the template ↓</a> · <Link href="/pricing">Compare plans</Link></p></div>
    <section id="machine-preview" ref={previewRef} style={{ scrollMarginTop: 110 }}><span className="eyebrow">YOUR PERSONALISED TEMPLATE</span><h2>This is what you are building towards.</h2><p className="small">An illustrative design using your answers, not an AI-generated or published machine. Blank details use clearly labelled example placements. Review final content and layout in your workspace before publishing.</p><CqaMachinePreview name={name} category={category} description={description} location={location} offers={offers} colour={colour} /><p className="small"><a href="#edit-preview">Edit with your business details ↓</a></p></section>
    <button type="button" className="button ghost" onClick={() => { setUsingExample(true); setName("Example Studio"); setCategory("Professional Services"); setDescription("Practical advice and personal support for local small businesses. Explore our services or send an enquiry to discuss what you need."); setLocation("Adelaide, South Australia"); setOffers([{ name: "Initial consultation", price: "" }, { name: "Business review", price: "" }]); reviewPreview(); }}>Try a filled example template</button>
    <p className="small">The example uses sample business details and no assumed prices. Replace it with your own details before creating a workspace.</p>
    <div id="edit-preview" style={{ scrollMarginTop: 110 }}><span className="eyebrow">MAKE THE TEMPLATE YOURS</span><h2>Your business, your offers.</h2></div>
    <label><span className="small">Business name</span><input required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Example: Summit Plumbing Co." /></label>
    <label><span className="small">Business category</span><select aria-describedby="category-help" style={{ colorScheme: "dark", backgroundColor: "#16111e", color: "#fff" }} value={category} onChange={(e) => setCategory(e.target.value)}>{["Trades & Services", "Beauty", "Fitness", "Coaching", "Professional Services", "Retail", "Creator", "Other"].map((item) => <option key={item}>{item}</option>)}</select><span id="category-help" className="small">Choose from eight business categories.</span></label>
    <label><span className="small">What does the business provide?</span><textarea required minLength={10} maxLength={2000} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your services, products and ideal customers." /></label>
    <div className="grid grid-2"><label><span className="small">Service area / location</span><input required minLength={2} maxLength={160} value={location} onChange={(e) => setLocation(e.target.value)} /></label><label><span className="small">Business phone</span><input maxLength={50} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" /></label></div>
    <fieldset style={{ border: "1px solid #ffffff25", borderRadius: 12, padding: "1rem" }}><legend>Your first offers · optional</legend><p className="small">Add up to three names and your own AUD prices. Leave prices blank if you quote individually. These drafts do not create live listings or accept payments.</p>{offers.map((offer, index) => <div key={index} className="grid grid-2" style={{ marginBottom: ".75rem" }}><label><span className="small">Offer {index + 1}</span><input maxLength={120} value={offer.name} placeholder="e.g. Initial consultation" onChange={(event) => setOffers(offers.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} /></label><label><span className="small">Price in AUD · optional</span><input type="number" min="0" max="999999" step="0.01" value={offer.price} placeholder="Price to be confirmed" onChange={(event) => setOffers(offers.map((item, i) => i === index ? { ...item, price: event.target.value } : item))} /></label></div>)}{offers.length < 3 ? <button type="button" className="button ghost" onClick={() => setOffers([...offers, { name: "", price: "" }])}>+ Add another offer</button> : null}</fieldset>
    <label style={{ display: "flex", alignItems: "center", gap: 15 }}><span className="small">Try a brand accent</span><input type="color" aria-label="Preview brand accent colour" value={colour} onChange={(event) => setColour(event.target.value)} style={{ width: 65, padding: 5, height: 44 }} /><span className="small">{colour}</span></label>
    <button type="button" className="button ghost" onClick={reviewPreview}>Review my updated visual preview ↑</button>
    <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend className="small" style={{ marginBottom: ".6rem" }}>Machine plan</legend><div className="grid grid-3">{CQA_PLANS.map((item) => <label key={item.key} className="glass-card" style={{ padding: "1rem", cursor: "pointer", border: plan === item.key ? "1px solid #ff7bd3" : undefined }}><input type="radio" name="plan" checked={plan === item.key} onChange={() => setPlan(item.key)} /> <strong>{item.name}</strong><br /><span className="small">A${item.price}/month · {item.fee}% sale fee</span><br /><span className="small"><strong>{item.setupMode}</strong> · {item.automationLevel}</span></label>)}</div></fieldset>
    {plan === "pro" ? <label className="glass-card" style={{ padding: "1rem" }}><input type="checkbox" checked={launchPackage} onChange={(event) => setLaunchPackage(event.target.checked)} /> <strong>Add Pro Launch Package — A$997 one-time setup</strong><p className="small">Branded setup, offers loaded, payment connection, automation, receptionist and sales follow-up drafts, and launch configuration. Pro remains A$297/month.</p></label> : null}
    <div className="glass-card" style={{ padding: "1rem" }}><strong>{chosenPlan.name}: A${chosenPlan.price}/month + {chosenPlan.fee}% CQA sale fee</strong><p className="small">{chosenPlan.slots} · {chosenPlan.setupMode} · {chosenPlan.automationLevel}</p><ul className="small">{chosenPlan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul><p className="small">{plan === "starter" ? "You fill and configure the machine yourself using guided setup." : "The paid build prepares drafts from your fuller setup answers. Review and edit them before going live; this free preview does not run AI."} Stripe processing fees are additional. Publishing and taking customer payments requires completing your Stripe connection.</p><strong>{plan === "pro" && launchPackage ? "First payment: A$1,294 (A$997 setup + A$297 first month). Then A$297/month." : `First payment: A$${chosenPlan.price}. Then A$${chosenPlan.price}/month.`}</strong></div>
    <label style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "1rem", border: "1px solid #ff7bd350", borderRadius: 12 }}><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} style={{ width: 20, marginTop: 3 }} /><span className="small">I have reviewed my template preview and selected plan costs. I understand this is a draft example, and I will finish setup and review the machine before publishing.</span></label>
    {userId ? <label><span className="small">Business contact email</span><input type="email" required maxLength={200} value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)} /></label> : <p className="small">Your preview is free. Secure login is needed only to save a private workspace or continue to Stripe. Your business draft stays in this browser for up to 24 hours, including when email login opens a new tab. Contact details and review confirmation are not stored with the preview.</p>}
    {error ? <div role="alert" style={{ padding: ".8rem 1rem", borderRadius: 10, border: "1px solid rgba(255,70,100,.4)" }}>{error}{userId ? <p><Link href="/owner/setup">Open my existing machine setup</Link></p> : null}</div> : null}
    <button className="button primary" type="submit" name="action" value="activate" disabled={loading || checking || !restored} style={{ justifyContent: "center" }}>{loading && submissionMode === "activate" ? "Creating secure checkout…" : userId ? "Continue with reviewed preview to Stripe" : "Keep my preview & continue to secure login"}</button>
    <button className="button ghost" type="submit" name="action" value="draft" disabled={loading || checking || !restored} style={{ justifyContent: "center" }}>{loading && submissionMode === "draft" ? "Saving your draft…" : userId ? "Save a draft without paying" : "Log in to save a free draft"}</button>
    <p className="small">Saving a draft opens your owner dashboard without starting checkout. A paid subscription is required to publish and use paid operations. A draft does not activate a plan or buy the Launch Package.</p>
  </form>;
}
export default function OnboardingPage() { return <main className="container" style={{ paddingTop: "2.5rem", paddingBottom: "4rem" }}><Suspense fallback={<p>Loading onboarding…</p>}><OnboardingForm /></Suspense></main>; }
