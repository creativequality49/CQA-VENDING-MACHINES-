import Link from "next/link";
import { CQA_WORKERS } from "@/lib/cqa-marketplace";

export default function WorkersPage() {
  return (
    <main className="container" style={{ paddingTop: "2.5rem", paddingBottom: "4rem" }}>
      <section className="glass-card" style={{ padding: "1.5rem", marginBottom: "1.25rem" }}>
        <span className="eyebrow">CQA AI WORKER STORE</span>
        <h1>Add operational workers to your business machine.</h1>
        <p className="small" style={{ maxWidth: 850 }}>Workers assist with repeatable business administration. Sensitive actions such as financial changes, customer disputes, publication and major price changes remain owner-approved.</p>
      </section>
      <section className="grid grid-2">
        {CQA_WORKERS.map(([id, name, price, description]) => (
          <article className="glass-card" key={id} style={{ padding: "1.25rem", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}><span className="eyebrow">AI WORKER</span><strong style={{ color: "#ff7bd3" }}>${price} AUD/month</strong></div>
            <h2>{name}</h2>
            <p className="small">{description}</p>
            <div style={{ marginTop: "auto" }}><Link href={`/owner/dashboard?addWorker=${id}`} className="button primary">Add to my machine</Link></div>
          </article>
        ))}
      </section>
      <section className="final-panel" style={{ marginTop: "1.5rem" }}>
        <div><span className="eyebrow">No machine yet?</span><h2>Start with the storefront, then add workers.</h2><p>Complete onboarding first so CQA can create the business record and machine workspace.</p></div>
        <Link href="/onboarding" className="button primary">Get My Machine</Link>
      </section>
    </main>
  );
}
