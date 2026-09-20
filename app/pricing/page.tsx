import Link from "next/link";
import { CQA_PLANS } from "@/lib/cqa-marketplace";

export default function PricingPage() {
  return (
    <main className="container neon-pricing-page" style={{ paddingTop: "2.5rem", paddingBottom: "4rem" }}>
      <section className="marketplace-neon-hero pricing-neon-hero">
        <div>
          <span className="eyebrow">CQA MACHINE RENTAL</span>
          <h1>Choose your machine level.</h1>
          <p>Each plan uses the same premium vending-machine structure. Capacity, fees and operating features increase as the business scales.</p>
        </div>
        <div className="marketplace-live-panel">
          <span>MONTHLY</span>
          <strong>3</strong>
          <small>operating levels</small>
        </div>
      </section>

      <section className="neon-plan-grid pricing-plan-grid">
        {CQA_PLANS.map((plan, index) => {
          const theme = index === 0 ? "pink" : index === 1 ? "cyan" : "gold";
          return (
            <article className={`neon-plan neon-plan-${theme} neon-plan-full`} key={plan.key}>
              <span className="plan-cap">CQΛ</span>
              <div className="plan-display">
                <span>{plan.name.toUpperCase()}</span>
                <strong>{"$"}{plan.price}</strong>
                <small>AUD / MONTH</small>
              </div>
              <div className="plan-features">
                <b>{plan.fee}% CQA marketplace fee</b>
                <span>{plan.slots}</span>
                {plan.features.map((feature) => <span key={feature}>✓ {feature}</span>)}
              </div>
              <Link href={`/onboarding?plan=${plan.key}`} className="neon-enter-button">CHOOSE {plan.name.toUpperCase()} →</Link>
            </article>
          );
        })}
      </section>

      <section className="glass-card neon-payment-note" style={{ padding: "1.25rem", marginTop: "1.5rem" }}>
        <div>
          <span className="eyebrow">PAYMENT ARCHITECTURE</span>
          <h2>Machine rental and customer payments stay separate.</h2>
          <p className="small">CQA bills the business for its machine plan. Customer payments are processed through that business’s connected Stripe account. Stripe processing fees remain separate from CQA fees.</p>
        </div>
        <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap" }}>
          <Link href="/workers" className="button ghost">See AI worker add-ons</Link>
          <Link href="/onboarding" className="button primary">Start onboarding</Link>
        </div>
      </section>
    </main>
  );
}
