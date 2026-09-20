"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CQA_PLANS, getBrowserSupabaseClient, type PlanKey } from "@/lib/cqa-marketplace";

type Business = {
  id: string;
  name: string;
  category: string;
  plan: PlanKey;
  description: string | null;
  logo_url: string | null;
};

type Machine = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  theme: string;
  status: string;
  template_key: string | null;
  template_locked: boolean;
  hero_image_url: string | null;
  customization: Record<string, unknown> | null;
};

type SetupProfile = {
  setup_mode?: "shell" | "guided" | "assisted" | "done_for_you";
  setup_status?: string;
  abn?: string | null;
  legal_name?: string | null;
  business_structure?: string | null;
  sales_model?: string[];
  fulfillment_model?: string[];
  shipping_regions?: string[];
  audience?: string | null;
  brand_direction?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  design_notes?: string | null;
  business_summary?: string | null;
  answers?: Record<string, unknown>;
  ai_draft?: Record<string, unknown>;
};

type Asset = { id: string; kind: string; public_url: string | null; file_name: string };
type SetupOffer = { id: string; name: string; offer_type: string; price_cents: number | null; image_url: string | null; active: boolean };

const SALES = ["Physical products", "Digital products", "Services", "Bookings", "Subscriptions", "Quotes"];
const FULFILMENT = ["Ship myself", "Print-on-demand", "Dropship / supplier", "Digital delivery", "Appointment / booking", "Local pickup"];
const INTEGRATIONS = ["Shopify", "Printify", "Instagram", "Facebook", "Fanvue", "Xero", "QuickBooks", "Bank feed", "Custom API / webhook"];

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function csv(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export default function OwnerSetupPage() {
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const search = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [machine, setMachine] = useState<Machine | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [offers, setOffers] = useState<SetupOffer[]>([]);
  const [productOfferId, setProductOfferId] = useState("");
  const [billingStatus, setBillingStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [building, setBuilding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);
  const [assetKind, setAssetKind] = useState("hero");

  const [setupMode, setSetupMode] = useState<"shell" | "guided" | "assisted" | "done_for_you">("guided");
  const [legalName, setLegalName] = useState("");
  const [abn, setAbn] = useState("");
  const [businessStructure, setBusinessStructure] = useState("");
  const [businessSummary, setBusinessSummary] = useState("");
  const [audience, setAudience] = useState("");
  const [salesModel, setSalesModel] = useState<string[]>([]);
  const [fulfilment, setFulfilment] = useState<string[]>([]);
  const [shippingRegions, setShippingRegions] = useState("Australia");
  const [brandDirection, setBrandDirection] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#ff2fae");
  const [secondaryColor, setSecondaryColor] = useState("#20d9ff");
  const [designNotes, setDesignNotes] = useState("");
  const [catalogBrief, setCatalogBrief] = useState("");
  const [integrationPriorities, setIntegrationPriorities] = useState<string[]>([]);

  const plan = business ? CQA_PLANS.find((item) => item.key === business.plan) : null;
  const activeBilling = ["active", "trialing"].includes(billingStatus);

  async function accessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }

  function loadSetup(profile: SetupProfile | null) {
    if (!profile) return;
    if (profile.setup_mode) setSetupMode(profile.setup_mode);
    setLegalName(profile.legal_name || "");
    setAbn(profile.abn || "");
    setBusinessStructure(profile.business_structure || "");
    setBusinessSummary(profile.business_summary || "");
    setAudience(profile.audience || "");
    setSalesModel(profile.sales_model || []);
    setFulfilment(profile.fulfillment_model || []);
    setShippingRegions((profile.shipping_regions || ["Australia"]).join(", "));
    setBrandDirection(profile.brand_direction || "");
    setPrimaryColor(profile.primary_color || "#ff2fae");
    setSecondaryColor(profile.secondary_color || "#20d9ff");
    setDesignNotes(profile.design_notes || "");
    const answers = profile.answers || {};
    setCatalogBrief(typeof answers.catalogBrief === "string" ? answers.catalogBrief : "");
    setIntegrationPriorities(Array.isArray(answers.integrationPriorities) ? answers.integrationPriorities as string[] : []);
  }

  async function load() {
    setLoading(true);
    setError("");
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user || null;
    setUserId(user?.id || null);
    if (!user) { setLoading(false); return; }

    const { data: businesses, error: businessError } = await supabase
      .from("cqa_businesses")
      .select("id,name,category,plan,description,logo_url")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1);

    if (businessError || !businesses?.[0]) {
      setError(businessError?.message || "No business machine exists yet.");
      setLoading(false);
      return;
    }

    const b = businesses[0] as Business;
    setBusiness(b);
    const token = sessionData.session?.access_token || "";
    const response = await fetch(`/api/owner/setup?businessId=${encodeURIComponent(b.id)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store"
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(result.error || "Unable to load machine setup.");
      setLoading(false);
      return;
    }

    setMachine(result.machine || null);
    setAssets(result.assets || []);
    setOffers(result.offers || []);
    if (!productOfferId && result.offers?.[0]?.id) setProductOfferId(result.offers[0].id);
    if (result.setup) loadSetup(result.setup);
    else setSetupMode(b.plan === "elite" ? "done_for_you" : b.plan === "pro" ? "assisted" : "guided");

    const { data: billing } = await supabase
      .from("cqa_plan_subscriptions")
      .select("status")
      .eq("business_id", b.id)
      .maybeSingle();
    setBillingStatus(billing?.status || "");
    setLoading(false);
  }

  useEffect(() => { void load(); }, [supabase]);

  useEffect(() => {
    if (search.get("billing") === "success") setMessage("Payment received. Complete the questions and build your machine.");
    if (search.get("billing") === "cancelled") setMessage("Checkout was cancelled. Your machine shell is saved.");
    if (search.get("billing") === "required") setMessage("Your shell is saved. Activate the plan before AI build or Stripe Connect.");
  }, [search]);

  async function saveSetup() {
    if (!business) return false;
    setSaving(true);
    setError("");
    const token = await accessToken();
    if (!token) { setError("Please log in again."); setSaving(false); return false; }

    const response = await fetch("/api/owner/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        businessId: business.id,
        setupMode,
        legalName,
        abn,
        businessStructure,
        businessSummary,
        audience,
        salesModel,
        fulfillmentModel: fulfilment,
        shippingRegions: csv(shippingRegions),
        brandDirection,
        primaryColor,
        secondaryColor,
        designNotes,
        answers: { catalogBrief, integrationPriorities },
        completedSteps: ["identity","sales","fulfilment","brand","catalog","integrations"]
      })
    });
    const result = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setError(result.error || "Unable to save setup.");
      return false;
    }
    setMessage("Machine setup saved.");
    return true;
  }

  async function buildMachine() {
    if (!business) return;
    const saved = await saveSetup();
    if (!saved) return;
    setBuilding(true);
    setError("");
    const token = await accessToken();
    const response = await fetch("/api/owner/setup/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ businessId: business.id })
    });
    const result = await response.json().catch(() => ({}));
    setBuilding(false);
    if (!response.ok) {
      setError(result.error || "Unable to build the machine.");
      return;
    }
    setMessage(result.message || "Draft machine built.");
    await load();
  }

  async function uploadFiles(files: File[]) {
    if (!files.length || !business || !userId || !machine) return;
    if (assetKind === "product" && !productOfferId) {
      setError("Choose the product or service slot this image belongs to.");
      return;
    }

    setUploading(true);
    setError("");

    for (const file of files) {
      if (!file.type.startsWith("image/")) { setError("Only image files can be uploaded here."); continue; }
      if (file.size > 10 * 1024 * 1024) { setError("Images must be 10MB or smaller."); continue; }

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
      const storagePath = `${userId}/${business.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("cqa-machine-media").upload(storagePath, file, { upsert: false });
      if (uploadError) { setError(uploadError.message); continue; }

      const { data: urlData } = supabase.storage.from("cqa-machine-media").getPublicUrl(storagePath);
      const publicUrl = urlData.publicUrl;
      const { data: asset, error: assetError } = await supabase.from("cqa_machine_assets").insert({
        business_id: business.id,
        machine_id: machine.id,
        offer_id: assetKind === "product" ? productOfferId : null,
        kind: assetKind,
        storage_path: storagePath,
        public_url: publicUrl,
        file_name: file.name,
        mime_type: file.type,
        size_bytes: file.size
      }).select("id,kind,public_url,file_name").single();

      if (assetError) { setError(assetError.message); continue; }
      if (assetKind === "hero") await supabase.from("cqa_machines").update({ hero_image_url: publicUrl }).eq("id", machine.id);
      if (assetKind === "logo") await supabase.from("cqa_businesses").update({ logo_url: publicUrl }).eq("id", business.id);
      if (assetKind === "product" && productOfferId) await supabase.from("cqa_offers").update({ image_url: publicUrl }).eq("id", productOfferId).eq("business_id", business.id);
      setAssets((current) => [...current, asset as Asset]);
    }

    setUploading(false);
    setMessage(assetKind === "product" ? "Product image assigned to its machine slot." : "Media uploaded to your machine.");
    await load();
  }

  async function uploadMedia(event: ChangeEvent<HTMLInputElement>) {
    await uploadFiles(Array.from(event.target.files || []));
    event.target.value = "";
  }

  async function dropMedia(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    await uploadFiles(Array.from(event.dataTransfer.files || []));
  }

  if (loading) return <main className="container owner-setup-page"><p>Loading your CQA machine builder…</p></main>;
  if (!userId) return <main className="container owner-setup-page"><section className="glass-card setup-panel"><h1>Owner login required.</h1><Link href="/login?next=/owner/setup" className="button primary">Log in</Link></section></main>;
  if (!business) return <main className="container owner-setup-page"><section className="glass-card setup-panel"><h1>No machine shell yet.</h1><Link href="/onboarding" className="button primary">Start onboarding</Link></section></main>;

  const questions = [
    {
      title: "First, confirm the business identity.",
      body: "This information stays in the owner workspace. CQA does not invent legal details.",
      content: <div className="setup-fields"><input value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="Legal business name" /><input value={abn} onChange={(e) => setAbn(e.target.value)} placeholder="ABN (optional)" /><select value={businessStructure} onChange={(e) => setBusinessStructure(e.target.value)}><option value="">Business structure</option><option>Sole trader</option><option>Company</option><option>Partnership</option><option>Trust</option><option>Other</option></select></div>
    },
    {
      title: "What does the business actually do?",
      body: "Describe the offer, ideal customer and why someone buys from you.",
      content: <div className="setup-fields"><textarea rows={5} value={businessSummary} onChange={(e) => setBusinessSummary(e.target.value)} placeholder="Business summary, products/services and key selling points" /><textarea rows={3} value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Ideal customer / audience" /></div>
    },
    {
      title: "What will this machine sell?",
      body: "Choose every sales model that applies.",
      content: <div className="setup-chip-grid">{SALES.map((item) => <button type="button" className={salesModel.includes(item) ? "setup-chip active" : "setup-chip"} key={item} onClick={() => setSalesModel(toggle(salesModel, item))}>{item}</button>)}</div>
    },
    {
      title: "How are orders fulfilled?",
      body: "This controls whether the machine needs shipping, digital delivery, booking or supplier hand-off.",
      content: <div className="setup-fields"><div className="setup-chip-grid">{FULFILMENT.map((item) => <button type="button" className={fulfilment.includes(item) ? "setup-chip active" : "setup-chip"} key={item} onClick={() => setFulfilment(toggle(fulfilment, item))}>{item}</button>)}</div><input value={shippingRegions} onChange={(e) => setShippingRegions(e.target.value)} placeholder="Shipping/service regions, comma separated" /></div>
    },
    {
      title: "Give the machine its brand direction.",
      body: "The activewear vending-machine structure is locked. We customise the brand, colour, hero media and products inside it.",
      content: <div className="setup-fields"><textarea rows={4} value={brandDirection} onChange={(e) => setBrandDirection(e.target.value)} placeholder="Brand style, mood, customer feeling" /><div className="setup-colors"><label>Primary <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} /></label><label>Secondary <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} /></label></div><textarea rows={3} value={designNotes} onChange={(e) => setDesignNotes(e.target.value)} placeholder="Extra design instructions" /></div>
    },
    {
      title: "Tell CQA what you want loaded into the machine.",
      body: "Paste or type products/services. Pro and Elite can turn this into installed draft offers automatically.",
      content: <textarea rows={8} value={catalogBrief} onChange={(e) => setCatalogBrief(e.target.value)} placeholder={"Example:\nPerformance leggings | $79 | physical | ships Australia\nVIP coaching | $149/month | subscription\nConsultation | $99 | booking"} />
    },
    {
      title: "Which business tools should the machine connect to?",
      body: "Connections requiring third-party OAuth/API approval remain disconnected until the account owner authorises them.",
      content: <div className="setup-chip-grid">{INTEGRATIONS.map((item) => <button type="button" className={integrationPriorities.includes(item) ? "setup-chip active" : "setup-chip"} key={item} onClick={() => setIntegrationPriorities(toggle(integrationPriorities, item))}>{item}</button>)}</div>
    }
  ];

  const current = questions[step];

  return (
    <main className="container owner-setup-page">
      <section className="setup-hero">
        <div>
          <span className="eyebrow">CQA BUSINESS-IN-A-BOX BUILDER</span>
          <h1>Tell CQA about the business. We prepare the machine.</h1>
          <p>{plan?.setupMode} · {plan?.automationLevel}</p>
        </div>
        <div className="setup-template-lock"><span>LOCKED MASTER TEMPLATE</span><strong>ACTIVEWEAR MASTER V1</strong><small>Structure locked · brand content editable</small></div>
      </section>

      {message ? <div className="setup-message">{message}</div> : null}
      {error ? <div className="setup-error">{error}</div> : null}

      <section className="setup-builder-grid">
        <article className="glass-card setup-chat">
          <div className="setup-progress"><span>QUESTION {step + 1} / {questions.length}</span><div><i style={{ width: `${((step + 1) / questions.length) * 100}%` }} /></div></div>
          <div className="setup-bot-bubble"><span>CQΛ BUILDER</span><h2>{current.title}</h2><p>{current.body}</p></div>
          <div className="setup-answer">{current.content}</div>
          <div className="setup-chat-actions">
            <button type="button" className="button ghost" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>Back</button>
            {step < questions.length - 1
              ? <button type="button" className="button primary" onClick={() => setStep((value) => Math.min(questions.length - 1, value + 1))}>Next question</button>
              : <button type="button" className="button primary" disabled={saving} onClick={() => void saveSetup()}>{saving ? "Saving…" : "Save questionnaire"}</button>}
          </div>
        </article>

        <aside className="setup-sidebar">
          <article className="glass-card setup-panel">
            <span className="eyebrow">YOUR PLAN</span>
            <h2>{plan?.name}</h2>
            <p className="small">{plan?.setupMode}</p>
            <p className="small">Billing: <strong>{billingStatus || "payment required"}</strong></p>
            {!activeBilling ? <Link href="/owner/dashboard" className="button primary">Activate plan</Link> : null}
          </article>

          <article className="glass-card setup-panel">
            <span className="eyebrow">UPLOAD TO MACHINE</span>
            <h3>Drag/drop-ready media</h3>
            <select value={assetKind} onChange={(e) => setAssetKind(e.target.value)}><option value="hero">Hero image</option><option value="logo">Logo</option><option value="product">Product / offer image</option><option value="gallery">Gallery image</option></select>
            {assetKind === "product" ? (
              offers.length ? (
                <select value={productOfferId} onChange={(e) => setProductOfferId(e.target.value)}>
                  <option value="">Choose product / offer slot</option>
                  {offers.map((offer) => <option key={offer.id} value={offer.id}>{offer.name}</option>)}
                </select>
              ) : <p className="small">Add or generate a product/service first, then assign its image here.</p>
            ) : null}
            <label className="setup-dropzone" onDragOver={(event) => event.preventDefault()} onDrop={dropMedia}>
              <input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" onChange={uploadMedia} />
              <strong>{uploading ? "Uploading…" : "Drop images here or tap to choose"}</strong>
              <small>{assetKind === "product" ? "Image will attach to the selected machine slot" : "PNG, JPG, WEBP or GIF · max 10MB"}</small>
            </label>
            {assets.length ? <div className="setup-asset-grid">{assets.slice(-6).map((asset) => asset.public_url ? <img key={asset.id} src={asset.public_url} alt={asset.file_name} /> : null)}</div> : null}
          </article>
        </aside>
      </section>

      <section className="glass-card setup-build-panel">
        <div>
          <span className="eyebrow">BUILD MODE</span>
          <h2>{business.plan === "elite" ? "Done-for-you machine draft" : business.plan === "pro" ? "AI-assisted machine build" : "Guided editable shell"}</h2>
          <p className="small">
            {business.plan === "starter"
              ? "Starter keeps the locked CQA shell and lets you load products manually. Upgrade to Pro for automatic build-and-install from your questionnaire."
              : "CQA can turn your saved answers into machine copy, colours, draft products/services, fulfilment fields and integration recommendations. Generated offers stay inactive until you review them."}
          </p>
        </div>
        <div className="setup-build-actions">
          <button type="button" className="button ghost" disabled={saving} onClick={() => void saveSetup()}>{saving ? "Saving…" : "Save progress"}</button>
          {business.plan === "starter"
            ? <Link href="/pricing" className="button primary">Upgrade for AI build</Link>
            : <button type="button" className="button primary" disabled={!activeBilling || building} onClick={() => void buildMachine()}>{building ? "Building machine…" : "Build & install draft"}</button>}
          <Link href="/owner/integrations" className="button ghost">Connections</Link>
          <Link href="/owner/dashboard" className="button ghost">Owner dashboard</Link>
        </div>
      </section>

      {machine ? (
        <section className="glass-card setup-machine-summary">
          <div><span className="eyebrow">MACHINE SHELL</span><h2>{machine.title}</h2><p className="small">{machine.subtitle || "Questionnaire not generated yet."}</p></div>
          <div className="setup-template-lock"><span>TEMPLATE</span><strong>{(machine.template_key || "activewear_master_v1").toUpperCase()}</strong><small>{machine.template_locked ? "Layout locked" : "Layout editable"} · status {machine.status}</small></div>
        </section>
      ) : null}
    </main>
  );
}
