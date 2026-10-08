import { getCqaChatProvider } from "@/lib/cqa-ai-provider";
import Link from "next/link";
import { CQA_WORKERS } from "@/lib/cqa-marketplace";

export const dynamic = "force-dynamic";

const workerMeta: Record<string, { area: string; outputs: string[] }> = {
  receptionist: { area: "Front desk", outputs: ["FAQ reply drafts", "Enquiry summaries", "Booking preparation"] },
  sales: { area: "Revenue", outputs: ["Lead qualification", "Offer matching", "Follow-up drafts"] },
  marketing: { area: "Marketing", outputs: ["Campaign drafts", "Social captions", "Email copy"] },
  "business-planner": { area: "Strategy", outputs: ["Business plans", "SWOT reviews", "Goal actions"] },
  stocktake: { area: "Operations", outputs: ["Stock signals", "Reorder flags", "Inventory summaries"] },
  finance: { area: "Finance admin", outputs: ["Sales summaries", "Admin flags", "Review queues"] },
  support: { area: "Customer care", outputs: ["Ticket triage", "Reply drafts", "Escalation preparation"] }
};

export default async function WorkersPage() {
  const aiReady = Boolean(
    (await getCqaChatProvider()) &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)
  );

  return (
    <main className="container" style={{ paddingTop: "2.5rem", paddingBottom: "5rem" }}>
      <section className="glass-card" style={{ padding: "1.6rem", marginBottom: "1.25rem" }}>
        <span className="eyebrow">CQA AI BUSINESS WORKFORCE</span>
        <h1>Specialist AI workers for businesses running on a CQA machine.</h1>
        <p className="small" style={{ maxWidth: 900 }}>
          The CQA AI core includes tenant-scoped business knowledge, persistent memory, approval gates and run logging.
          {aiReady
            ? " Pro and Enterprise include all three draft workers; Starter can add individual worker subscriptions."
            : " Paid worker activation is paused until the production model provider is connected, so customers cannot be charged for an unavailable AI service."}
        </p>
        <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap" }}>
          <Link href="/pricing" className="button primary">Launch a Machine</Link>
          <Link href="/machines" className="button ghost">View CQA Solutions</Link>
        </div>
      </section>

      <section className="grid grid-3" style={{ marginBottom: "1.25rem" }}>
        <article className="glass-card" style={{ padding: "1rem" }}>
          <span className="eyebrow">GROUNDING</span>
          <h3>Business-aware outputs</h3>
          <p className="small">Stored policies, FAQs, offers and instructions are retrieved as context instead of relying on generic guesses.</p>
        </article>
        <article className="glass-card" style={{ padding: "1rem" }}>
          <span className="eyebrow">MEMORY</span>
          <h3>Durable business context</h3>
          <p className="small">Long-term facts can be retained per business and owner so repeated workflows do not start from zero.</p>
        </article>
        <article className="glass-card" style={{ padding: "1rem" }}>
          <span className="eyebrow">GUARDRAILS</span>
          <h3>Approval before sensitive action</h3>
          <p className="small">Payments, refunds, legal commitments, security changes and irreversible publishing require approval.</p>
        </article>
      </section>

      <section className="grid grid-2">
        {CQA_WORKERS.map(([id, name, price, description]) => {
          const meta = workerMeta[id] || { area: "Operations", outputs: [] };
          return (
            <article className="glass-card" key={id} style={{ padding: "1.25rem", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
                <span className="eyebrow">{meta.area}</span>
                <strong style={{ color: "#61eff9" }}>Included with Pro / Enterprise · ${price}/month on Starter</strong>
              </div>
              <h2>{name}</h2>
              <p className="small">{description}</p>
              <div className="revenue-stack" style={{ margin: ".5rem 0 1rem" }}>
                {meta.outputs.map((output) => (
                  <div key={output}><span>✓</span><strong>{output}</strong></div>
                ))}
              </div>
              <div style={{ marginTop: "auto" }}>
                {aiReady ? (
                  <Link href={"/owner/dashboard?worker=" + id} className="button primary">Open dashboard</Link>
                ) : (
                  <Link href="/contact?service=ai-worker" className="button ghost">Request activation</Link>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <section className="final-panel" style={{ marginTop: "1.5rem" }}>
        <div>
          <span className="eyebrow">START SELLING FIRST</span>
          <h2>The core digital vending machine is available now.</h2>
          <p>Launch the commerce layer with Pro or Enterprise and use the included draft workers. Starter offers optional worker subscriptions.</p>
        </div>
        <Link href="/onboarding?plan=starter" className="button primary">Launch Starter</Link>
      </section>
    </main>
  );
}
