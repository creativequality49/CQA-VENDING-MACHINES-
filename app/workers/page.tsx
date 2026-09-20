import Link from "next/link";
import { CQA_WORKERS } from "@/lib/cqa-marketplace";

const workerMeta: Record<string, { area: string; outputs: string[] }> = {
  receptionist: { area: "Front desk", outputs: ["FAQ responses", "Lead capture", "Booking preparation"] },
  sales: { area: "Revenue", outputs: ["Lead qualification", "Offer matching", "Follow-up preparation"] },
  "business-planner": { area: "Strategy", outputs: ["Business plans", "SWOT reviews", "Goal actions"] },
  stocktake: { area: "Operations", outputs: ["Stock signals", "Reorder flags", "Inventory summaries"] },
  finance: { area: "Finance admin", outputs: ["Sales summaries", "Admin flags", "Review queues"] },
  support: { area: "Customer care", outputs: ["Ticket triage", "Reply drafts", "Escalation preparation"] }
};

export default function WorkersPage() {
  return (
    <main className="container" style={{ paddingTop: "2.5rem", paddingBottom: "5rem" }}>
      <section className="glass-card" style={{ padding: "1.6rem", marginBottom: "1.25rem" }}>
        <span className="eyebrow">CQA AI WORKER STORE</span>
        <h1>Add operational capacity without adding another dashboard.</h1>
        <p className="small" style={{ maxWidth: 850 }}>
          Each worker is a monthly CQA add-on attached to your existing business machine. Stripe confirms the subscription first; CQA then enables the worker in your private workspace. Sensitive actions remain approval-gated.
        </p>
        <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap" }}>
          <Link href="/owner/dashboard" className="button primary">Open Owner Workspace</Link>
          <Link href="/machines" className="button ghost">View CQA Solutions</Link>
        </div>
      </section>

      <section className="grid grid-3" style={{ marginBottom: "1.25rem" }}>
        <article className="glass-card" style={{ padding: "1rem" }}><span className="eyebrow">01 · SELECT</span><h3>Choose the job</h3><p className="small">Pick only the operational role your machine needs.</p></article>
        <article className="glass-card" style={{ padding: "1rem" }}><span className="eyebrow">02 · SUBSCRIBE</span><h3>Secure Stripe billing</h3><p className="small">Complete the worker’s monthly CQA subscription.</p></article>
        <article className="glass-card" style={{ padding: "1rem" }}><span className="eyebrow">03 · ACTIVATE</span><h3>Webhook-controlled access</h3><p className="small">The worker enables only after Stripe confirms active billing.</p></article>
      </section>

      <section className="grid grid-2">
        {CQA_WORKERS.map(([id, name, price, description]) => {
          const meta = workerMeta[id] || { area: "Operations", outputs: [] };
          return (
            <article className="glass-card" key={id} style={{ padding: "1.25rem", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
                <span className="eyebrow">{meta.area}</span>
                <strong style={{ color: "#ff7bd3" }}>{"$"}{price} AUD/month</strong>
              </div>
              <h2>{name}</h2>
              <p className="small">{description}</p>
              <div className="revenue-stack" style={{ margin: ".5rem 0 1rem" }}>
                {meta.outputs.map((output) => <div key={output}><span>✓</span><strong>{output}</strong></div>)}
              </div>
              <div style={{ marginTop: "auto" }}>
                <Link href={`/owner/dashboard?worker=${id}`} className="button primary">Subscribe & add to my machine</Link>
              </div>
            </article>
          );
        })}
      </section>

      <section className="final-panel" style={{ marginTop: "1.5rem" }}>
        <div>
          <span className="eyebrow">NO MACHINE YET?</span>
          <h2>Start with the business machine, then layer workers onto it.</h2>
          <p>The machine subscription creates the commercial workspace; workers are separate monthly operational add-ons.</p>
        </div>
        <Link href="/onboarding" className="button primary">Get My Machine</Link>
      </section>
    </main>
  );
}
