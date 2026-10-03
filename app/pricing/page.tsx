import Link from "next/link";
import { CQA_PLANS } from "@/lib/cqa-marketplace";

const planCopy = {
  starter: {
    label: "LIVE NOW",
    intro: "Launch a branded digital vending machine with payments, lead capture and guided setup.",
    cta: "Launch Starter",
    href: "/onboarding?plan=starter"
  },
  pro: {
    label: "AI-ASSISTED",
    intro: "Scale the machine with AI-assisted copy, draft offers and broader business integrations.",
    cta: "Request Pro Access",
    href: "/contact?service=pro-ai"
  },
  elite: {
    label: "DONE FOR YOU",
    intro: "A higher-touch build with advanced setup, integration planning and priority launch support.",
    cta: "Talk to CQA",
    href: "/contact?service=elite"
  }
} as const;

export default function PricingPage() {
  const aiReady = Boolean(
    (process.env.CQA_CHAT_API_KEY || process.env.OPENAI_API_KEY) &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)
  );

  return (
    <main className="container neon-pricing-page" style={{ paddingTop: "2.5rem", paddingBottom: "4rem" }}>
      <section className="marketplace-neon-hero pricing-neon-hero">
        <div>
          <span className="eyebrow">CQA DIGITAL VENDING MACHINE PLANS</span>
          <h1>Launch the business machine first. Add the AI workforce as you scale.</h1>
          <p>
            Starter is available for immediate self-serve activation. Pro and Elite include AI-assisted capability and are opened only when the production AI layer is ready.
          </p>
        </div>
        <div className="marketplace-live-panel">
          <span>CORE COMMERCE</span>
          <strong>LIVE</strong>
          <small>Stripe + secure onboarding</small>
        </div>
      </section>

      <section className="neon-plan-grid pricing-plan-grid">
        {CQA_PLANS.map((plan, index) => {
          const item = planCopy[plan.key];
          const theme = index === 0 ? "pink" : index === 1 ? "cyan" : "gold";
          const available = plan.key === "starter" || aiReady;
          const href =
            plan.key === "starter"
              ? item.href
              : available && plan.key === "pro"
                ? "/onboarding?plan=pro"
                : item.href;
          const cta =
            plan.key === "starter"
              ? item.cta
              : available && plan.key === "pro"
                ? "Launch Pro"
                : item.cta;

          return (
            <article
              className={`neon-plan neon-plan-${theme} neon-plan-full ${plan.key === "starter" ? "neon-plan-featured" : ""}`}
              key={plan.key}
            >
              <span className="plan-popular-badge">
                {plan.key === "starter" ? "AVAILABLE NOW" : available ? item.label : "ACCESS BY APPROVAL"}
              </span>
              <span className="plan-cap">CQΛ</span>
              <div className="plan-display">
                <span>{plan.name.toUpperCase()}</span>
                <strong>${plan.price}</strong>
                <small>AUD / MONTH</small>
              </div>
              <p className="plan-intro">{item.intro}</p>
              <div className="plan-features">
                {plan.features.map((feature) => (
                  <span key={feature}>✓ {feature}</span>
                ))}
              </div>
              <Link href={href} className="neon-enter-button">
                {cta} →
              </Link>
            </article>
          );
        })}
      </section>

      <section
        className="glass-card"
        style={{
          padding: "1.4rem",
          marginTop: "1.25rem",
          display: "flex",
          justifyContent: "space-between",
          gap: "1rem",
          alignItems: "center",
          flexWrap: "wrap"
        }}
      >
        <div>
          <span className="eyebrow">CQA AI BUSINESS WORKFORCE</span>
          <h2 style={{ margin: ".35rem 0" }}>
            {aiReady ? "Add specialist AI workers to an active machine." : "AI worker architecture is built; paid activation is currently gated."}
          </h2>
          <p className="small" style={{ margin: 0 }}>
            {aiReady
              ? "Choose specialist roles for sales, support, planning, finance admin and operations."
              : "This prevents customers being charged for AI capability before the production model provider is active."}
          </p>
        </div>
        <Link href="/workers" className="button primary">View AI Workforce</Link>
      </section>

      <p className="pricing-reassurance">
        Starter can be launched now. Stripe subscription state is activated only from signed payment events.
      </p>

      <section className="faq-section">
        <span className="eyebrow">FAQ</span>
        <h2>Questions before you launch?</h2>
        <div className="faq-grid">
          <article>
            <h3>What can I launch today?</h3>
            <p>The Starter vending machine is open for self-serve signup, billing, setup and Stripe Connect onboarding.</p>
          </article>
          <article>
            <h3>Can I upgrade later?</h3>
            <p>Yes. Your machine is designed to move into Pro, Elite and specialist AI workers as those capabilities are activated for your account.</p>
          </article>
          <article>
            <h3>Does CQA hold customer card details?</h3>
            <p>No. Secure checkout and subscription billing are handled through Stripe.</p>
          </article>
          <article>
            <h3>What can the machine sell?</h3>
            <p>It can present products, services, bookings, subscriptions, quotes and external commerce links based on your setup.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
