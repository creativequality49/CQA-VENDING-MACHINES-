"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/cqa-marketplace";

type Business = { id: string; name: string };
type Template = { key: string; name: string; description: string; trigger_type: string; steps: Array<{ step_type: string; name: string }> };
type Automation = { id: string; business_id: string; name: string; description: string | null; trigger_type: string; status: string; cqa_automation_steps?: Array<{ id: string; step_order: number; step_type: string; name: string }> };
type Run = { id: string; automation_id: string; status: string; trigger_type: string; created_at: string; next_run_at: string | null; error_text: string | null };
type Contact = { id: string; business_id: string; email: string; name: string | null; status: string; tags: string[]; source: string };
type Connection = { id: string; provider: string; label: string; status: string; capabilities: string[] };
type ContextItem = { id: string; kind: string; title: string; content: string; active: boolean };
type Payload = { templates: Template[]; businesses: Business[]; automations: Automation[]; runs: Run[]; contacts: Contact[]; connections: Connection[]; context: ContextItem[]; error?: string };

const emptyPayload: Payload = { templates: [], businesses: [], automations: [], runs: [], contacts: [], connections: [], context: [] };

function statusTone(status: string) {
  if (["active", "connected", "succeeded"].includes(status)) return "rgba(80,255,180,.18)";
  if (["failed", "error"].includes(status)) return "rgba(255,70,100,.16)";
  return "rgba(255,255,255,.08)";
}

export default function OwnerAutomationsPage() {
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const [data, setData] = useState<Payload>(emptyPayload);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [contextTitle, setContextTitle] = useState("");
  const [contextContent, setContextContent] = useState("");

  async function token() {
    const { data: session } = await supabase.auth.getSession();
    return session.session?.access_token || "";
  }

  async function load() {
    setLoading(true); setError("");
    const accessToken = await token();
    if (!accessToken) { setLoading(false); setError("Log in to manage CQA automations."); return; }
    const response = await fetch("/api/automations", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
    const payload = await response.json() as Payload;
    if (!response.ok) setError(payload.error || "Unable to load automations.");
    else setData(payload);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function createAutomation(templateKey: string) {
    const business = data.businesses[0];
    if (!business) return setError("Create a business machine before adding automations.");
    setBusy(templateKey); setError(""); setMessage("");
    const accessToken = await token();
    const response = await fetch("/api/automations", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ businessId: business.id, templateKey }) });
    const result = await response.json();
    if (!response.ok) setError(result.error || "Unable to create automation.");
    else { setMessage("Automation activated. New matching events can now enter this workflow."); await load(); }
    setBusy("");
  }

  async function updateStatus(automationId: string, status: "active" | "paused") {
    setBusy(automationId); setError("");
    const accessToken = await token();
    const response = await fetch("/api/automations", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ automationId, status }) });
    const result = await response.json();
    if (!response.ok) setError(result.error || "Unable to update automation.");
    else { setMessage(status === "active" ? "Automation resumed." : "Automation paused."); await load(); }
    setBusy("");
  }

  async function runAutomation(automation: Automation) {
    setBusy(`run-${automation.id}`); setError(""); setMessage("");
    const accessToken = await token();
    const contact = data.contacts.find((item) => item.business_id === automation.business_id && item.status === "subscribed");
    const response = await fetch("/api/automations/run", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ automationId: automation.id, contactId: contact?.id || null, payload: { source: "owner_dashboard_test", note: "Manual owner test" } }) });
    const result = await response.json();
    if (!response.ok) setError(result.error || "Unable to run automation.");
    else { setMessage(`Run started with status: ${result.run?.status || "queued"}.`); await load(); }
    setBusy("");
  }

  async function addContext(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const business = data.businesses[0];
    if (!business || !contextTitle.trim() || !contextContent.trim()) return;
    setBusy("context"); setError("");
    const { error: insertError } = await supabase.from("cqa_context_items").insert({ business_id: business.id, kind: "instruction", title: contextTitle.trim(), content: contextContent.trim(), active: true });
    if (insertError) setError(insertError.message);
    else { setContextTitle(""); setContextContent(""); setMessage("Shared business context added. Agent tasks can use it on future runs."); await load(); }
    setBusy("");
  }

  const activeCount = data.automations.filter((item) => item.status === "active").length;
  const successfulRuns = data.runs.filter((item) => item.status === "succeeded").length;

  return (
    <main className="container" style={{ paddingTop: "2rem", paddingBottom: "4rem" }}>
      <section className="glass-card" style={{ padding: "1.5rem", marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
          <div><span className="eyebrow">CQA AUTOMATIONS</span><h1 style={{ marginBottom: ".35rem" }}>Automate what does not need you.</h1><p className="small" style={{ maxWidth: 760 }}>Build once, then let CQA respond to leads, nurture subscribers, prepare follow-ups and run repeatable business tasks using shared context.</p></div>
          <Link href="/owner/dashboard" className="button ghost">Back to dashboard</Link>
        </div>
        {message ? <div role="status" style={{ marginTop: "1rem", padding: ".8rem", border: "1px solid rgba(80,255,180,.35)", borderRadius: 10 }}>{message}</div> : null}
        {error ? <div role="alert" style={{ marginTop: "1rem", padding: ".8rem", border: "1px solid rgba(255,70,100,.4)", borderRadius: 10 }}>{error}</div> : null}
      </section>

      <section className="grid grid-3" style={{ marginBottom: "1rem" }}>
        <article className="glass-card" style={{ padding: "1rem" }}><span className="eyebrow">ACTIVE WORKFLOWS</span><h2>{activeCount}</h2><p className="small">Running against live business events.</p></article>
        <article className="glass-card" style={{ padding: "1rem" }}><span className="eyebrow">CONTACTS</span><h2>{data.contacts.length}</h2><p className="small">Subscribers, leads and customers in this workspace.</p></article>
        <article className="glass-card" style={{ padding: "1rem" }}><span className="eyebrow">SUCCESSFUL RUNS</span><h2>{successfulRuns}</h2><p className="small">Recent completed automation runs.</p></article>
      </section>

      <section className="glass-card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
        <span className="eyebrow">START WITH A PROVEN FLOW</span><h2>Automation templates</h2>
        <div className="grid grid-2">
          {data.templates.map((template) => <article className="glass-card" style={{ padding: "1rem" }} key={template.key}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: ".7rem" }}><div><h3>{template.name}</h3><p className="small">Trigger: {template.trigger_type.replaceAll("_", " ")}</p></div><span className="eyebrow">{template.steps.length} STEPS</span></div>
            <p className="small">{template.description}</p>
            <div className="revenue-stack" style={{ marginBottom: ".8rem" }}>{template.steps.map((step, index) => <div key={`${template.key}-${index}`}><span>{index + 1}</span><strong>{step.name}</strong><small>{step.step_type.replaceAll("_", " ")}</small></div>)}</div>
            <button type="button" className="button primary" disabled={busy === template.key || loading} onClick={() => createAutomation(template.key)}>{busy === template.key ? "Adding…" : "Activate Template"}</button>
          </article>)}
        </div>
      </section>

      <section className="glass-card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
        <span className="eyebrow">LIVE WORKFLOWS</span><h2>Your automations</h2>
        {loading ? <p className="small">Loading automation workspace…</p> : data.automations.length ? <div className="grid grid-2">{data.automations.map((automation) => <article className="glass-card" style={{ padding: "1rem" }} key={automation.id}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: ".5rem", flexWrap: "wrap" }}><h3>{automation.name}</h3><span style={{ padding: ".25rem .5rem", borderRadius: 999, background: statusTone(automation.status), fontSize: ".78rem" }}>{automation.status.toUpperCase()}</span></div>
          <p className="small">{automation.description}</p>
          <p className="small"><strong>Trigger:</strong> {automation.trigger_type.replaceAll("_", " ")} · <strong>Steps:</strong> {automation.cqa_automation_steps?.length || 0}</p>
          <div style={{ display: "flex", gap: ".55rem", flexWrap: "wrap" }}><button type="button" className="button primary" disabled={busy === `run-${automation.id}` || automation.status !== "active"} onClick={() => runAutomation(automation)}>Run Test</button><button type="button" className="button ghost" disabled={busy === automation.id} onClick={() => updateStatus(automation.id, automation.status === "active" ? "paused" : "active")}>{automation.status === "active" ? "Pause" : "Resume"}</button></div>
        </article>)}</div> : <p className="small">No workflows yet. Activate a template above.</p>}
      </section>

      <section className="grid grid-2" style={{ marginBottom: "1rem" }}>
        <form onSubmit={addContext} className="glass-card" style={{ padding: "1.25rem", display: "grid", gap: ".75rem" }}><span className="eyebrow">SHARED CONTEXT</span><h2>Teach CQA how this business works</h2><p className="small">Store approved business instructions, policies, FAQs and operating context once so agent tasks can reuse them.</p><input required placeholder="Context title" value={contextTitle} onChange={(e) => setContextTitle(e.target.value)} /><textarea required rows={6} placeholder="Example: Quotes over $1,500 require owner approval. Never promise same-day service unless the owner confirms availability." value={contextContent} onChange={(e) => setContextContent(e.target.value)} /><button className="button primary" type="submit" disabled={busy === "context"}>{busy === "context" ? "Saving…" : "Add Shared Context"}</button></form>
        <article className="glass-card" style={{ padding: "1.25rem" }}><span className="eyebrow">CONNECTIONS</span><h2>Business tools</h2><p className="small">Connections are shared at the business level. Secret values stay in deployment/provider vaults, not in browser-readable tables.</p>{data.connections.length ? <div className="revenue-stack">{data.connections.map((connection) => <div key={connection.id}><span>{connection.status.toUpperCase()}</span><strong>{connection.label}</strong><small>{connection.provider} · {connection.capabilities.join(", ") || "configured capabilities"}</small></div>)}</div> : <div className="revenue-stack"><div><span>CORE</span><strong>Stripe + CQA Database</strong><small>Existing machine payments and business data</small></div><div><span>OPTIONAL</span><strong>Email + AI provider</strong><small>Activated from secure deployment environment settings</small></div><div><span>CONTROLLED</span><strong>Webhooks / APIs</strong><small>Only approved allowlisted destinations execute automatically</small></div></div>}</article>
      </section>

      <section className="glass-card" style={{ padding: "1.25rem" }}><span className="eyebrow">RUN HISTORY</span><h2>What CQA has done</h2>{data.runs.length ? <div className="revenue-stack">{data.runs.slice(0, 20).map((run) => <div key={run.id}><span style={{ background: statusTone(run.status) }}>{run.status.toUpperCase()}</span><strong>{data.automations.find((item) => item.id === run.automation_id)?.name || "Automation"}</strong><small>{new Date(run.created_at).toLocaleString("en-AU")}{run.next_run_at ? ` · resumes ${new Date(run.next_run_at).toLocaleString("en-AU")}` : ""}{run.error_text ? ` · ${run.error_text.slice(0, 120)}` : ""}</small></div>)}</div> : <p className="small">No automation runs recorded yet.</p>}</section>
    </main>
  );
}
