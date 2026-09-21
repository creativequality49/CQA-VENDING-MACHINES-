import Link from "next/link";
import { NeonMachineCard } from "@/components/NeonMachineCard";
import { CQA_PLANS, CQA_WORKERS, DEMO_MACHINES } from "@/lib/cqa-marketplace";

const launchSteps = [
  { number: "01", title: "CHOOSE", accent: "cyan", description: "Choose the business category, plan and machine capacity.", visual: ["FITNESS", "BEAUTY", "HOME SERVICES"] },
  { number: "02", title: "CUSTOMISE", accent: "pink", description: "Apply the logo, brand colours, services and customer-facing layout.", visual: ["BRAND", "SERVICES", "OFFERS"] },
  { number: "03", title: "AUTOMATE", accent: "violet", description: "Add AI workers for reception, sales, follow-up, support and reporting.", visual: ["BOOKING", "LEADS", "FOLLOW-UP", "REPORTING"] },
  { number: "04", title: "LAUNCH", accent: "gold", description: "Publish the machine, connect payments and operate from the owner dashboard.", visual: ["LIVE", "STRIPE", "DASHBOARD"] }
];

export default function HomePage() {
  return (
    <main className="home-page">
      <section className="hero-shell cqa-neon-hero">
        <div className="hero-orb hero-orb-one" />
        <div className="hero-orb hero-orb-two" />
        <div className="container hero-grid cqa-hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">CREATIVE QUALITY AUSTRALIA · BUSINESS-IN-A-BOX</span>
            <h1>Your business. <span>Already built into the machine.</span></h1>
            <p className="hero-lead">Rent a branded digital vending machine, answer the guided business setup, load products or let CQA AI build the draft for you. Sell products, services, bookings, subscriptions and memberships from one premium storefront.</p>
            <div className="hero-signal-row" aria-label="CQA platform capabilities">
              <span>AI AGENTS</span><i /> <span>AUTOMATION</span><i /> <span>REVENUE SYSTEMS</span>
            </div>
            <div className="hero-actions">
              <Link href="/marketplace" className="button primary">Enter Marketplace</Link>
              <Link href="/onboarding" className="button ghost">Build My Machine</Link>
            </div>
            <div className="proof-row">
              <div className="proof-item"><strong>24/7</strong><span>Customer access</span></div>
              <div className="proof-item"><strong>6</strong><span>AI worker roles</span></div>
              <div className="proof-item"><strong>Stripe</strong><span>Connected payments</span></div>
              <div className="proof-item"><strong>1</strong><span>Owner dashboard</span></div>
            </div>
          </div>
          <div className="hero-machine-wrap">
            <div className="hero-machine-label"><span>FLAGSHIP MASTER</span><strong>ACTIVEWEAR VENDING MACHINE</strong><small>Same premium shell · customised for every business</small></div>
            <NeonMachineCard machine={DEMO_MACHINES[0]} compact />
          </div>
        </div>
      </section>

      <section className="container section-block cqa-process-section">
        <div className="section-heading">
          <div><span className="eyebrow">CHOOSE · CUSTOMISE · AUTOMATE · LAUNCH</span><h2>The four-step CQA machine build.</h2></div>
          <p>This is the live responsive version of your four-panel concept: the same neon vending-machine language, rebuilt as part of the website rather than a static image.</p>
        </div>
        <div className="cqa-process-grid">
          {launchSteps.map((step) => (
            <article className={`cqa-process-card process-${step.accent}`} key={step.number}>
              <header><span>{step.number}</span><h3>{step.title}</h3></header>
              <div className="process-stage">
                <div className="process-mini-machine">
                  <div className="process-machine-screen">CQΛ</div>
                  <div className="process-machine-slots">{step.visual.map((item) => <span key={item}>{item}</span>)}</div>
                  <div className="process-machine-base"><i /> SYSTEM READY</div>
                </div>
              </div>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
        <div className="process-footer-strip">WEBSITE <i /> AI WORKERS <i /> OWNER DASHBOARD <i /> STRIPE PAYMENTS</div>
      </section>

      <section className="container section-block">
        <div className="section-heading">
          <div><span className="eyebrow">THE CQA MACHINE SYSTEM</span><h2>One premium machine architecture. A different business inside every shell.</h2></div>
          <p>The activewear machine is the locked visual master. Each customer changes the brand, products, services, colours, media and automations — not the CQA machine structure.</p>
        </div>
        <div className="neon-machine-grid">{DEMO_MACHINES.map((machine) => <NeonMachineCard machine={machine} key={machine.slug} />)}</div>
        <div style={{ marginTop: "1.25rem" }}><Link href="/marketplace" className="button ghost">See the full marketplace</Link></div>
      </section>

      <section className="dark-band">
        <div className="container section-block">
          <div className="section-heading compact"><div><span className="eyebrow">How the system works</span><h2>The machine is the storefront. CQA automation runs behind it.</h2></div></div>
          <div className="flow-grid">
            <article className="flow-card"><span>01</span><h3>Choose a plan</h3><p>Select capacity, selling slots and the CQA operating level.</p></article>
            <article className="flow-card"><span>02</span><h3>Customise</h3><p>Apply business identity, colours, offers and customer-facing content.</p></article>
            <article className="flow-card"><span>03</span><h3>Connect Stripe</h3><p>The business connects its own Stripe account for eligible customer payments.</p></article>
            <article className="flow-card"><span>04</span><h3>Add workers</h3><p>Layer in reception, sales, planning, stocktake, finance and support automation.</p></article>
            <article className="flow-card"><span>05</span><h3>Launch</h3><p>CQA reviews the machine before it becomes public in the marketplace.</p></article>
          </div>
        </div>
      </section>

      <section className="container section-block" id="plans">
        <div className="section-heading">
          <div><span className="eyebrow">Machine plans</span><h2>Choose the operating level. Keep the vending-machine look.</h2></div>
          <Link href="/pricing" className="text-link">Compare all plans →</Link>
        </div>
        <div className="neon-plan-grid home-plan-grid">
          {CQA_PLANS.map((plan, index) => {
            const theme = index === 0 ? "pink" : index === 1 ? "cyan" : "gold";
            return (
              <article className={`neon-plan neon-plan-${theme} ${plan.key === "pro" ? "neon-plan-featured" : ""}`} key={plan.key}>
                {plan.key === "pro" ? <span className="plan-popular-badge">MOST POPULAR</span> : null}
                <span className="plan-cap">CQΛ</span>
                <div className="plan-display"><span>{plan.name.toUpperCase()}</span><strong>{"$"}{plan.price}</strong><small>AUD / MONTH</small></div>
                <div className="plan-features">
                  <b>{plan.fee}% CQA marketplace fee</b><span>{plan.slots}</span>
                  {plan.features.slice(0, 4).map((feature) => <span key={feature}>✓ {feature}</span>)}
                </div>
                <Link href={`/onboarding?plan=${plan.key}`} className="neon-enter-button">CHOOSE PLAN →</Link>
              </article>
            );
          })}
        </div>
      </section>

      <section className="container section-block split-panel">
        <div>
          <span className="eyebrow">CQA AI Worker Store</span>
          <h2>Add workers behind the machine without changing the storefront.</h2>
          <p>Workers assist with reception, sales, planning, stocktake, finance administration and support. Sensitive actions remain approval-gated so the owner stays in control.</p>
          <Link href="/workers" className="button ghost">Explore AI workers</Link>
        </div>
        <div className="revenue-stack">
          {CQA_WORKERS.slice(0, 4).map(([id, name, price]) => <div key={id}><span>+</span><strong>{name}</strong><small>From {"$"}{price} AUD/month</small></div>)}
        </div>
      </section>

      <section className="container final-panel">
        <div><span className="eyebrow">READY TO BUILD?</span><h2>Launch a CQA vending machine.</h2><p>Create the owner account, choose a plan and start building the branded machine.</p></div>
        <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap" }}><Link href="/onboarding" className="button primary">Build My Machine</Link><Link href="/login?next=/owner/dashboard" className="button ghost">Owner Login</Link></div>
      </section>
    </main>
  );
}
