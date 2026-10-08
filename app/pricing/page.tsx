import Link from "next/link";
import { CQA_PLANS } from "@/lib/cqa-marketplace";

const planCopy = {
  starter: { label: "START SIMPLE", intro: "A clear digital front door for a small business getting started.", cta: "Choose Starter", features: ["Branded machine and business profile", "Guided setup and image uploads", "Products, services and lead capture", "Stripe payment connection", "Private owner dashboard"] },
  pro: { label: "RECOMMENDED", intro: "Your main business machine, with room for more offers and a richer customer experience.", cta: "Build My Digital Vending Machine", features: ["Everything in Starter", "More selling slots and business tools", "Bookings, subscriptions and offer details", "Your colours, hero and product images", "Receptionist, sales and marketing drafts included", "Owner-configured purchase automations"] },
  elite: { label: "FOR LARGER OPERATIONS", intro: "A higher-touch plan for businesses with broader setup and launch needs.", cta: "Choose Enterprise", features: ["Everything in Pro", "Expanded selling and integration capacity", "Advanced fulfilment and commerce links", "CQA review and launch support", "All three AI draft workers included"] }
} as const;

export default function PricingPage() {
  return (
    <main className="container neon-pricing-page cqa-offer-page" style={{ paddingTop: "2.5rem", paddingBottom: "4rem" }}>
      <section className="marketplace-neon-hero pricing-neon-hero">
        <div>
          <span className="eyebrow">YOUR BUSINESS. OPEN 24/7.</span>
          <h1>Choose your digital vending machine.</h1>
          <p>Give customers one place to browse your offers, buy, request a booking and get in touch. Start with a monthly plan, or choose the Pro Launch Package for help putting your machine together.</p>
        </div>
        <div className="marketplace-live-panel"><span>MAIN OFFER</span><strong>PRO</strong><small>$297 AUD / month</small></div>
      </section>
      <section className="neon-plan-grid pricing-plan-grid" aria-label="Monthly machine plans">
        {CQA_PLANS.map((plan) => {
          const item = planCopy[plan.key];
          return <article className={`neon-plan neon-plan-cyan neon-plan-full ${plan.key === "pro" ? "neon-plan-featured" : ""}`} key={plan.key}>
            <span className="plan-popular-badge">{item.label}</span>
            <span className="plan-cap">CQΛ</span>
            <div className="plan-display"><span>{plan.name.toUpperCase()}</span><strong>${plan.price}</strong><small>AUD / MONTH</small></div>
            <p className="plan-intro">{item.intro}</p>
            <div className="plan-features">{item.features.map(feature => <span key={feature}>✓ {feature}</span>)}</div>
            <Link href={`/onboarding?plan=${plan.key}`} className="neon-enter-button">{item.cta} →</Link>
          </article>;
        })}
      </section>
      <section className="cqa-launch-package glass-card" aria-labelledby="launch-package-title">
        <div><span className="eyebrow">PRO LAUNCH PACKAGE</span><h2 id="launch-package-title">Get your machine ready with CQA.</h2><p>For owners who want help implementing their storefront: business setup, offer structure, branding, receptionist and sales follow-up drafts, and a launch review.</p><p className="cqa-package-price"><strong>$997</strong> AUD one-off setup <span>+ $297 AUD / month for Pro</span></p><p className="small">The setup fee applies when you select this package. Standard Pro is available as a monthly plan above.</p></div>
        <Link href="/onboarding?plan=pro&package=launch" className="button primary">Choose Pro Launch Package →</Link>
      </section>
      <p className="pricing-reassurance">All prices are in AUD. Payment processing fees and optional Starter worker subscriptions are additional. Review your total in secure checkout.</p>
      <section className="faq-section"><span className="eyebrow">BEFORE YOU LAUNCH</span><h2>A clear next step.</h2><div className="faq-grid">
        <article><h3>What happens after I choose a plan?</h3><p>Create your owner account, add your business details and continue to secure checkout. Then use guided setup to prepare your machine and connect your payment account.</p></article>
        <article><h3>Do I need the launch package?</h3><p>You can set up your machine yourself on a monthly plan. Pro Launch adds CQA implementation support for a one-off $997 setup fee.</p></article>
        <article><h3>What can I offer?</h3><p>Present products, services, bookings, subscriptions, quotes and external commerce links according to your business setup. Customer payments require your connected payment account.</p></article>
        <article><h3>Are AI workers included?</h3><p>Pro and Enterprise include receptionist, sales and marketing workers that prepare drafts for your review. Starter can add individual monthly worker subscriptions. Workers do not send customer replies or publish marketing automatically.</p></article>
      </div></section>
    </main>
  );
}
