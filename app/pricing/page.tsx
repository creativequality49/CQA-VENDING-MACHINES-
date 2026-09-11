import Link from "next/link";
import { CQA_PLANS } from "@/lib/cqa-marketplace";

export default function PricingPage() {
  return (
    <main className="container" style={{ paddingTop: "2.5rem", paddingBottom: "4rem" }}>
      <section className="glass-card" style={{ padding: "1.5rem", marginBottom: "1.25rem" }}>
        <span className="eyebrow">CQA MACHINE RENTAL</span>
        <h1>Choose the operating level that fits your business.</h1>
        <p className="small" style={{ maxWidth: 850 }}>Each plan includes a branded machine inside the CQA marketplace and an owner workspace. Your business connects its own Stripe account and remains responsible for its customer sales, refunds and disputes.</p>
      </section>

      <section className="machine-grid-home">
        {CQA_PLANS.map((plan) => (
          <article className={`machine-card-home ${plan.key === "pro" ? "cyan" : plan.key === "elite" ? "gold" : ""}`} key={plan.key}>
            <div className="machine-card-topline"><span>{plan.name}</span><strong>{plan.fee}% CQA sale fee</strong></div>
            <h2 style={{ fontSize: "2rem", marginBottom: ".2rem" }}>${plan.price}<small style={{ fontSize: ".9rem" }}> AUD/month</small></h2>
            <p>{plan.slots}</p>
            <ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
            <Link href={`/onboarding?plan=${plan.key}`} className="button primary" style={{ justifyContent: "center", marginTop: "auto" }}>Choose {plan.name}</Link>
          </article>
        ))}
      </section>

      <section className="glass-card" style={{ padding: "1.25rem", marginTop: "1.5rem" }}>
        <h2>How payments work</h2>
        <p className="small">Customer payments are processed through the individual business’s connected Stripe account. Stripe processing fees are separate from CQA fees. CQA charges the machine rental independently and can collect the plan’s application fee on eligible marketplace transactions.</p>
        <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap" }}><Link href="/workers" className="button ghost">See AI worker add-ons</Link><Link href="/onboarding" className="button primary">Start onboarding</Link></div>
      </section>
    </main>
  );
}
