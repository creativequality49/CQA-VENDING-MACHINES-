"use client";
import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { CQA_WORKERS, getBrowserSupabaseClient } from "@/lib/cqa-marketplace";

export default function OwnerWorkersPage() {
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const [workerId, setWorkerId] = useState("receptionist");
  const [task, setTask] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState("");
  async function run(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setAnswer("");
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { window.location.assign("/login?next=/owner/workers"); return; }
      const response = await fetch("/api/owner/workers", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ workerId, task }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Worker request failed.");
      setAnswer(result.answer || "The worker returned no answer. Please try again.");
    } catch (e) { setError(e instanceof Error ? e.message : "Worker request failed."); }
    finally { setBusy(false); }
  }
  return <main className="container" style={{ paddingTop: "2rem", paddingBottom: "4rem" }}><h1>Your AI workers</h1><p>Prepare customer replies, sales follow-ups and marketing drafts using your business context. Review every draft before sending or publishing.</p><Link href="/owner/dashboard" className="button ghost">Subscriptions and dashboard</Link><form onSubmit={run} className="glass-card" style={{ padding: "1.5rem", marginTop: "1rem", display: "grid", gap: "1rem" }}><label>Worker<select value={workerId} onChange={(e) => setWorkerId(e.target.value)}>{CQA_WORKERS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><label>Your request<textarea required minLength={2} maxLength={4000} rows={6} value={task} onChange={(e) => setTask(e.target.value)} placeholder="Draft a reply to this customer enquiry…" /></label><button className="button primary" disabled={busy}>{busy ? "Preparing draft…" : "Run worker"}</button>{error ? <p role="alert">{error}</p> : null}{answer ? <section aria-live="polite"><h2>Draft for your review</h2><p style={{ whiteSpace: "pre-wrap" }}>{answer}</p></section> : null}</form></main>;
}
