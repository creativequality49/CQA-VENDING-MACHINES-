import Link from "next/link";
import { CQA_PLANS } from "@/lib/cqa-marketplace";

export default function PricingPage() {
  return (
    <main className="container neon-pricing-page" style={{ paddingTop: "2.5rem", paddingBottom: "4rem" }}>
      <section className="marketplace-neon-hero pricing-neon-hero">
        <div>
          <span className="eyebrow">CQA MACHINE RENTAL</span>
          <h1>Choose how much of the machine CQA builds for you.</h1>
          <p>Starter gives you the guided shell. Pro turns your answers into an AI-assisted machine draft. Elite prepares the done-for-you business machine for review and launch.</p>
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
            <article className={`neon-plan neon-plan-${theme} neon-plan-full ${plan.key === "pro" ? "neon-plan-featured" : ""}`} key={plan.key}>
              {plan.key === "pro" ? <span className="plan-popular-badge">MOST POPULAR</span> : null}
              <span className="plan-cap">CQΛ</span>
              <div className="plan-display">
                <span>{plan.name.toUpperCase()}</span>
                <strong>{"$"}{plan.price}</strong>
                <small>AUD / MONTH</small>
              </div>
              <div style={{ padding: "12px 6px 0", textAlign: "center" }}>
                <strong style={{ color: "var(--plan-accent)", fontSize: ".85rem" }}>{plan.setupMode}</strong>
                <p className="small" style={{ margin: ".35rem 0 0" }}>{plan.automationLevel}</p>
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
