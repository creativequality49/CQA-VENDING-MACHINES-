import Link from "next/link";
import { CQA_PLANS, CQA_WORKERS } from "@/lib/cqa-marketplace";

const solutions = [
  {
    label: "BUSINESS VENDING MACHINE",
    title: "Launch a branded machine",
    description: "Sell services, bookings, products and subscriptions through a CQA storefront with an owner workspace and Stripe Connect.",
    href: "/pricing",
    cta: "Compare machine plans"
  },
  {
    label: "AI WORKFORCE",
    title: "Add operational workers",
    description: "Add reception, sales, planning, stocktake, finance or customer-support workers as paid monthly add-ons.",
    href: "/workers",
    cta: "Browse AI workers"
  },
  {
    label: "LEAD CAPTURE",
    title: "Build a prospecting pipeline",
    description: "Use the CQA Lead Machine to research prospects and prepare structured lead data for outreach and automation.",
    href: "/lead-machine",
    cta: "Open Lead Machine"
  },
  {
    label: "AI READINESS",
    title: "Find the highest-value automation",
    description: "Run the readiness assessment to identify time loss, operational friction and the strongest automation starting point.",
    href: "/quiz",
    cta: "Take the assessment"
  }
];

export default function MachinesPage() {
  return (
    <main className="container" style={{ paddingTop: "2.75rem", paddingBottom: "5rem" }}>
      <section className="glass-card" style={{ padding: "1.6rem", marginBottom: "1.5rem" }}>
        <span className="eyebrow">CQA SOLUTION HUB</span>
        <h1>One commercial system, four ways to remove manual work.</h1>
        <p className="small" style={{ maxWidth: 850 }}>
          Start with the revenue surface you need now, then add automation and AI workers behind it. The customer-facing marketplace, owner workspace, payments and operational automations remain connected.
        </p>
        <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap" }}>
          <Link href="/onboarding" className="button primary">Launch My Machine</Link>
          <Link href="/marketplace" className="button ghost">Explore Marketplace</Link>
          <Link href="/contact" className="button ghost">Talk to CQA</Link>
        </div>
      </section>

      <section className="grid grid-2" style={{ marginBottom: "1.5rem" }}>
        {solutions.map((solution, index) => (
          <article className="glass-card" key={solution.title} style={{ padding: "1.35rem", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
              <span className="eyebrow">{solution.label}</span>
              <strong style={{ color: "#ff7bd3" }}>0{index + 1}</strong>
            </div>
            <h2>{solution.title}</h2>
            <p className="small">{solution.description}</p>
            <div style={{ marginTop: "auto" }}><Link href={solution.href} className="button primary">{solution.cta}</Link></div>
          </article>
        ))}
      </section>

      <section className="grid grid-2" style={{ marginBottom: "1.5rem" }}>
        <article className="glass-card" style={{ padding: "1.35rem" }}>
          <span className="eyebrow">MACHINE RENTAL</span>
          <h2>Choose capacity first.</h2>
          <div className="revenue-stack">
            {CQA_PLANS.map((plan) => (
              <div key={plan.key}>
                <span>{plan.fee}%</span>
                <strong>{plan.name} · {"$"}{plan.price} AUD/month</strong>
                <small>{plan.slots} · platform fee shown at left</small>
              </div>
            ))}
          </div>
          <Link href="/pricing" className="text-link">Compare plan inclusions →</Link>
        </article>

        <article className="glass-card" style={{ padding: "1.35rem" }}>
          <span className="eyebrow">WORKER LAYER</span>
          <h2>Add only the jobs you need.</h2>
          <div className="revenue-stack">
            {CQA_WORKERS.slice(0, 4).map(([id, name, price]) => (
              <div key={id}>
                <span>+</span>
                <strong>{name}</strong>
                <small>{"$"}{price} AUD/month</small>
              </div>
            ))}
          </div>
          <Link href="/workers" className="text-link">See all six workers →</Link>
        </article>
      </section>

      <section className="final-panel">
        <div>
          <span className="eyebrow">NEED A CUSTOM BUILD?</span>
          <h2>Use CQA implementation instead of forcing your business into a template.</h2>
          <p>Send the current bottleneck, customer flow or automation requirement and keep the work connected to the same CQA operating stack.</p>
        </div>
        <Link href="/contact" className="button primary">Start a CQA Request</Link>
      </section>
    </main>
  );
}
