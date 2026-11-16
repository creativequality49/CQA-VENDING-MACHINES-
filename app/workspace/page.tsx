import Link from "next/link";
import { CQA_WORKERS } from "@/lib/cqa-marketplace";

export const metadata = {
  title: "Business Workspace | Creative Quality Australia",
  description: "Manage your digital vending machines and AI workforce from one CQA workspace."
};

const workerDescriptions: Record<string, string> = {
  receptionist: "Prepare answers to enquiries and qualified leads for your approval.",
  sales: "Prepare lead follow-ups and sales drafts for your approval.",
  marketing: "Prepare product campaigns, captions and marketing drafts for your approval."
};

export default function BusinessWorkspacePage() {
  return (
    <main className="container" style={{ paddingTop: "2rem", paddingBottom: "7rem" }}>
      <section className="glass-card" style={{ padding: "clamp(1.25rem,4vw,2.5rem)", marginBottom: "1rem" }}>
        <span className="eyebrow">CREATIVE QUALITY AUSTRALIA · BUSINESS WORKSPACE</span>
        <h1 style={{ maxWidth: "18ch", lineHeight: 1.1 }}>Your business. Your machines. Your AI workforce.</h1>
        <p style={{ maxWidth: "62ch" }}>One connected workspace for your storefronts, orders, subscriptions and AI worker access. Sign in to manage your actual business data.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: ".75rem" }}>
          <Link className="button primary" href="/owner/dashboard">Open My Business Dashboard</Link>
          <Link className="button ghost" href="/onboarding">Build a Digital Machine</Link>
        </div>
      </section>
      <section className="grid grid-2" aria-label="Business modules" style={{ marginBottom: "1.5rem" }}>
        <article className="glass-card" style={{ padding: "1.5rem" }}>
          <span className="eyebrow">01 · DIGITAL VENDING</span>
          <h2>My Vending Machines</h2>
          <p>Manage your branded storefront, product listings, orders and machine subscription in the existing owner dashboard.</p>
          <Link className="button primary" href="/owner/dashboard">Manage Machines</Link>
          <p className="small"><Link href="/dashboard/library">Customer Download Library</Link></p>
        </article>
        <article className="glass-card" style={{ padding: "1.5rem" }}>
          <span className="eyebrow">02 · AI WORKFORCE</span>
          <h2>My AI Employees</h2>
          <p>Review your existing AI worker subscriptions and enabled access. Automated execution remains restricted until operational checks pass.</p>
          <Link className="button primary" href="/owner/dashboard#ai-workforce">Manage AI Workforce</Link>
          <p className="small"><Link href="/workers">Explore AI Workers</Link></p>
        </article>
      </section>
      <section className="glass-card" style={{ padding: "1.5rem" }}>
        <span className="eyebrow">CONNECTED WORKFORCE CATALOGUE</span>
        <h2>AI employees linked to your business</h2>
        <div className="grid grid-3">
          {CQA_WORKERS.map(([id, name, price]) => (
            <article className="glass-card" key={id} style={{ padding: "1rem" }}>
              <h3>{name}</h3>
              <p>{workerDescriptions[id] || "Review AI worker capabilities and access."}</p>
              <p className="small">Listed add-on: AUD ${price}/month · confirm current checkout availability before subscribing.</p>
              <Link href={`/owner/dashboard?addWorker=${encodeURIComponent(id)}#ai-workforce`} className="button ghost">View Access & Billing</Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
