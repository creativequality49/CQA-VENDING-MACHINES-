import Link from "next/link";
import { CQA_PLANS, CQA_WORKERS, DEMO_MACHINES } from "@/lib/cqa-marketplace";

export default function HomePage() {
  return (
    <main className="home-page">
      <section className="hero-shell">
        <div className="hero-orb hero-orb-one" />
        <div className="hero-orb hero-orb-two" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">Creative Quality Australia · Business Vending Marketplace</span>
            <h1>
              Your business.<br />
              <span>Your machine. Your customers. Your revenue.</span>
            </h1>
            <p className="hero-lead">
              CQA gives Australian businesses a branded digital vending machine inside a shared discovery marketplace. Sell services, bookings, products and subscriptions, then add AI workers to help run the admin behind the scenes.
            </p>
            <div className="hero-actions">
              <Link href="/marketplace" className="button primary">Explore the Marketplace</Link>
              <Link href="/onboarding" className="button ghost">Get My Business Machine</Link>
            </div>
            <div className="proof-row">
              <div className="proof-item"><strong>24/7</strong><span>Storefront availability</span></div>
              <div className="proof-item"><strong>1–5%</strong><span>CQA platform fee by plan</span></div>
              <div className="proof-item"><strong>6</strong><span>Optional AI worker types</span></div>
              <div className="proof-item"><strong>AU</strong><span>Built for Australian businesses</span></div>
            </div>
          </div>

          <div className="vending-stage" aria-label="CQA marketplace machine preview">
            <div className="vending-shell">
              <div className="vending-head">
                <div className="brand-badge">CQA</div>
                <div className="live-pill"><i /> MARKETPLACE LIVE</div>
              </div>
              <div className="vending-screen">
                <span>BUSINESS MACHINE</span>
                <strong>SELL · BOOK<br />SUBSCRIBE</strong>
                <small>ONE STOREFRONT · ONE OWNER WORKSPACE</small>
              </div>
              <div className="vending-slots">
                {["SERVICES", "BOOKINGS", "PRODUCTS", "MEMBERS", "QUOTES", "AI HELP"].map((slot, index) => (
                  <div className="vending-slot" key={slot}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <b>{slot}</b>
                  </div>
                ))}
              </div>
              <div className="vending-console">
                <div><span>YOUR BUSINESS</span><strong>READY TO LAUNCH</strong></div>
                <Link href="/onboarding">START</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container section-block">
        <div className="section-heading">
          <div><span className="eyebrow">Marketplace preview</span><h2>What CQA looks like with businesses inside it.</h2></div>
          <p>These examples are clearly marked demonstrations until pilot businesses are approved and published. Real machines will appear automatically once their owners complete onboarding and CQA approval.</p>
        </div>
        <div className="machine-grid-home">
          {DEMO_MACHINES.map((machine) => (
            <article className="machine-card-home cyan" key={machine.slug}>
              <div className="machine-card-topline"><span>{machine.business.category}</span><strong>DEMO</strong></div>
              <div className="machine-card-visual">
                <div className="machine-window"><span>{machine.business.name.slice(0, 2).toUpperCase()}</span></div>
                <div className="machine-dots">{Array.from({ length: 8 }).map((_, index) => <i key={index} />)}</div>
              </div>
              <h3>{machine.business.name}</h3>
              <p>{machine.subtitle}</p>
              <ul>{machine.offers.slice(0, 3).map((offer) => <li key={offer.id}>{offer.name}</li>)}</ul>
              <Link href={`/machine/${machine.slug}`} className="card-link">Enter demo machine <span>→</span></Link>
            </article>
          ))}
        </div>
        <div style={{ marginTop: "1.25rem" }}><Link href="/marketplace" className="button ghost">See the full marketplace</Link></div>
      </section>

      <section className="dark-band">
        <div className="container section-block">
          <div className="section-heading compact">
            <div><span className="eyebrow">How it works</span><h2>CQA handles the platform. The business owns the customer relationship.</h2></div>
          </div>
          <div className="flow-grid">
            <article className="flow-card"><span>01</span><h3>Choose a plan</h3><p>Starter, Pro or Elite determines selling capacity, platform fee and available worker upgrades.</p></article>
            <article className="flow-card"><span>02</span><h3>Complete onboarding</h3><p>Add business details, branding, offers and the information CQA needs to prepare the machine.</p></article>
            <article className="flow-card"><span>03</span><h3>Connect payments</h3><p>The business connects its own Stripe account so its customers pay that business directly.</p></article>
            <article className="flow-card"><span>04</span><h3>CQA approves launch</h3><p>Listings, payments and customer-facing details are reviewed before the machine becomes public.</p></article>
            <article className="flow-card"><span>05</span><h3>Operate and expand</h3><p>Manage offers and bookings from the owner dashboard and add AI workers as the business grows.</p></article>
          </div>
        </div>
      </section>

      <section className="container section-block" id="plans">
        <div className="section-heading">
          <div><span className="eyebrow">Recurring machine plans</span><h2>Simple rent plus a lower platform fee as you scale.</h2></div>
          <Link href="/pricing" className="text-link">Compare all plans →</Link>
        </div>
        <div className="machine-grid-home">
          {CQA_PLANS.map((plan) => (
            <article className="machine-card-home" key={plan.key}>
              <div className="machine-card-topline"><span>{plan.name}</span><strong>{plan.fee}% per sale</strong></div>
              <h3>${plan.price} AUD/month</h3>
              <p>{plan.slots}</p>
              <ul>{plan.features.slice(0, 4).map((feature) => <li key={feature}>{feature}</li>)}</ul>
              <Link href={`/onboarding?plan=${plan.key}`} className="card-link">Choose {plan.name} <span>→</span></Link>
            </article>
          ))}
        </div>
      </section>

      <section className="container section-block split-panel">
        <div>
          <span className="eyebrow">CQA AI Worker Store</span>
          <h2>Add operational help without rebuilding your machine.</h2>
          <p>Workers assist with reception, sales, planning, stocktake, finance administration and customer support. Sensitive changes remain approval-gated so the owner stays in control.</p>
          <Link href="/workers" className="button ghost">Explore AI workers</Link>
        </div>
        <div className="revenue-stack">
          {CQA_WORKERS.slice(0, 4).map(([id, name, price]) => (
            <div key={id}><span>+</span><strong>{name}</strong><small>From ${price} AUD/month</small></div>
          ))}
        </div>
      </section>

      <section className="container final-panel">
        <div>
          <span className="eyebrow">Ready for pilot businesses</span>
          <h2>Launch a machine under CQA.</h2>
          <p>Create your owner account, submit your business and prepare your first offers for CQA review.</p>
        </div>
        <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap" }}>
          <Link href="/onboarding" className="button primary">Get My Machine</Link>
          <Link href="/login?next=/owner/dashboard" className="button ghost">Owner Login</Link>
        </div>
      </section>
    </main>
  );
}
