"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getBrowserSupabaseClient } from "@/lib/cqa-marketplace";

type Business = { id: string; name: string; plan: "starter" | "pro" | "elite" };
type Connection = { id: string; provider: string; label: string; status: string; metadata: Record<string, unknown>; capabilities: string[] };

const PROVIDERS = [
  { id: "shopify", name: "Shopify", group: "Commerce", capabilities: ["catalog","orders","inventory"], note: "Store catalog, orders and inventory." },
  { id: "printify", name: "Printify", group: "Fulfilment", capabilities: ["catalog","fulfilment"], note: "Print-on-demand products and fulfilment." },
  { id: "instagram", name: "Instagram", group: "Marketing", capabilities: ["social","marketing"], note: "Marketing account and content workflow." },
  { id: "facebook", name: "Facebook / Meta", group: "Marketing", capabilities: ["social","marketing"], note: "Pages, ads and social activity." },
  { id: "fanvue", name: "Fanvue", group: "Creator", capabilities: ["creator","audience"], note: "Creator funnel / account connection request." },
  { id: "xero", name: "Xero", group: "Accounting", capabilities: ["accounting","reconciliation"], note: "Accounting and transaction workflow." },
  { id: "quickbooks", name: "QuickBooks", group: "Accounting", capabilities: ["accounting","reconciliation"], note: "Accounting and bookkeeping workflow." },
  { id: "bank_feed", name: "Business Banking", group: "Finance", capabilities: ["banking","reconciliation"], note: "Bank-feed connection for finance automation." },
  { id: "custom_api", name: "Custom API / Webhook", group: "Advanced", capabilities: ["api","webhook"], note: "Connect another approved service through an API or webhook." }
] as const;

export default function OwnerIntegrationsPage() {
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const [business, setBusiness] = useState<Business | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [billingStatus, setBillingStatus] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [customUrl, setCustomUrl] = useState("");

  async function load() {
    setError("");
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) return;
    const { data: businesses } = await supabase.from("cqa_businesses").select("id,name,plan").eq("owner_id", user.id).order("created_at").limit(1);
    const b = businesses?.[0] as Business | undefined;
    if (!b) return;
    setBusiness(b);
    const [{ data: c }, { data: billing }] = await Promise.all([
      supabase.from("cqa_business_connections").select("id,provider,label,status,metadata,capabilities").eq("business_id", b.id).order("provider"),
      supabase.from("cqa_plan_subscriptions").select("status").eq("business_id", b.id).maybeSingle()
    ]);
    setConnections((c as Connection[] | null) || []);
    setBillingStatus(billing?.status || "");
  }

  useEffect(() => { void load(); }, [supabase]);

  function connection(provider: string) {
    return connections.find((item) => item.provider === provider);
  }

  async function requestProvider(provider: typeof PROVIDERS[number]) {
    if (!business) return;
    setBusy(provider.id);
    setMessage("");
    setError("");

    if (provider.id === "shopify" || provider.id === "printify" || provider.id === "instagram" || provider.id === "facebook" || provider.id === "fanvue" || provider.id === "xero" || provider.id === "quickbooks" || provider.id === "bank_feed") {
      const { error: upsertError } = await supabase.from("cqa_business_connections").upsert({
        business_id: business.id,
        provider: provider.id,
        label: provider.name,
        status: "disconnected",
        capabilities: provider.capabilities,
        metadata: {
          requested: true,
          requested_at: new Date().toISOString(),
          connection_method: "oauth_or_provider_api",
          note: "Owner connection requested. Do not store raw provider passwords in CQA."
        },
        updated_at: new Date().toISOString()
      }, { onConflict: "business_id,provider" });

      if (upsertError) setError(upsertError.message);
      else setMessage(`${provider.name} has been added to the connection queue. The account still needs provider authorisation before data can sync.`);
      setBusy("");
      await load();
      return;
    }
  }

  async function connectStripe() {
    if (!business) return;
    setBusy("stripe");
    setError("");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) { setError("Please log in again."); setBusy(""); return; }
    const response = await fetch("/api/marketplace/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ businessId: business.id })
    });
    const result = await response.json().catch(() => ({}));
    setBusy("");
    if (!response.ok || !result.url) { setError(result.error || "Unable to open Stripe Connect."); return; }
    window.location.assign(result.url);
  }

  async function saveCustom(event: FormEvent) {
    event.preventDefault();
    if (!business || !customLabel.trim() || !customUrl.trim()) return;
    setBusy("custom_api");
    const { error: upsertError } = await supabase.from("cqa_business_connections").upsert({
      business_id: business.id,
      provider: "custom_api",
      label: customLabel.trim(),
      status: "disconnected",
      capabilities: ["api","webhook"],
      metadata: { requested: true, external_url: customUrl.trim(), requested_at: new Date().toISOString() },
      updated_at: new Date().toISOString()
    }, { onConflict: "business_id,provider" });
    setBusy("");
    if (upsertError) setError(upsertError.message);
    else { setMessage("Custom connection request saved."); setCustomLabel(""); setCustomUrl(""); await load(); }
  }

  if (!business) {
    return <main className="container owner-connections-page"><section className="glass-card setup-panel"><h1>Connect a business machine first.</h1><Link href="/onboarding" className="button primary">Start onboarding</Link></section></main>;
  }

  const activeBilling = ["active","trialing"].includes(billingStatus);

  return (
    <main className="container owner-connections-page">
      <section className="setup-hero">
        <div>
          <span className="eyebrow">CQA CONNECTION CENTRE</span>
          <h1>Connect the tools that already run the business.</h1>
          <p>Commerce, fulfilment, social, accounting and finance connections sit behind the same vending-machine storefront.</p>
        </div>
        <div className="setup-template-lock"><span>SECURITY RULE</span><strong>OWNER AUTHORISES PROVIDERS</strong><small>CQA never asks for raw banking or social passwords.</small></div>
      </section>

      {message ? <div className="setup-message">{message}</div> : null}
      {error ? <div className="setup-error">{error}</div> : null}

      <section className="glass-card integrations-stripe">
        <div><span className="eyebrow">PAYMENTS</span><h2>Stripe Connect</h2><p className="small">Customer money flows through the business’s own Stripe account. CQA machine billing remains separate.</p></div>
        <button type="button" className="button primary" disabled={!activeBilling || busy === "stripe"} onClick={connectStripe}>{!activeBilling ? "Activate plan first" : busy === "stripe" ? "Opening Stripe…" : "Connect / Review Stripe"}</button>
      </section>

      <section className="integration-grid">
        {PROVIDERS.filter((provider) => provider.id !== "custom_api").map((provider) => {
          const item = connection(provider.id);
          const requested = Boolean(item?.metadata?.requested);
          return (
            <article className="glass-card integration-card" key={provider.id}>
              <div className="integration-card-head"><span className="eyebrow">{provider.group}</span><span className={item?.status === "connected" ? "integration-status connected" : requested ? "integration-status queued" : "integration-status"}>{item?.status === "connected" ? "CONNECTED" : requested ? "REQUESTED" : "AVAILABLE"}</span></div>
              <h2>{provider.name}</h2>
              <p className="small">{provider.note}</p>
              <div className="integration-capabilities">{provider.capabilities.map((capability) => <span key={capability}>{capability}</span>)}</div>
              <button type="button" className="button ghost" disabled={busy === provider.id || item?.status === "connected"} onClick={() => void requestProvider(provider)}>{item?.status === "connected" ? "Connected" : requested ? "Update request" : "Add connection"}</button>
            </article>
          );
        })}
      </section>

      <form onSubmit={saveCustom} className="glass-card custom-connection-form">
        <div><span className="eyebrow">OTHER PLATFORM</span><h2>Add another business tool.</h2><p className="small">Store the provider name and public integration URL. Secrets and OAuth tokens must be handled through secure provider authorisation, not this form.</p></div>
        <div className="setup-fields"><input required value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} placeholder="Provider / app name" /><input required type="url" value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} placeholder="https:// provider or API URL" /><button className="button primary" type="submit" disabled={busy === "custom_api"}>{busy === "custom_api" ? "Saving…" : "Save connection request"}</button></div>
      </form>

      <section className="glass-card integration-next">
        <div><span className="eyebrow">AUTOMATION LAYER</span><h2>Connections feed the workers.</h2><p className="small">Once authorised, connected commerce and marketing data can support AI sales, support, stocktake, finance and marketing workflows based on the business’s plan and enabled workers.</p></div>
        <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap" }}><Link href="/owner/setup" className="button ghost">Machine Builder</Link><Link href="/workers" className="button primary">Add AI Workers</Link></div>
      </section>
    </main>
  );
}
