import Link from "next/link";
import { CQA_AUTOMATION_OFFERS, firstPaymentAud } from "@/lib/cqa-automation-catalog";

function Money({ value }: { value: number }) {
  return <>{new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(value)}</>;
}

export const metadata = {
  title: "CQA Business Automations | Creative Quality Australia",
  description: "Done-for-you AI workers and business automations with live Stripe checkout."
};

export default function AutomationsPage() {
  const packages = CQA_AUTOMATION_OFFERS.filter((item) => item.category === "package");
  const specialist = CQA_AUTOMATION_OFFERS.filter((item) => item.category === "worker" || item.category === "industry");
  const custom = CQA_AUTOMATION_OFFERS.find((item) => item.category === "custom");

  const renderOffer = (offer: (typeof CQA_AUTOMATION_OFFERS)[number], featured = false) => {
    const first = firstPaymentAud(offer);
    return (
      <article className="glass-card" key={offer.id} style={{ padding: "1.35rem", display: "flex", flexDirection: "column", borderColor: featured ? "rgba(32,217,255,.5)" : undefined }}>
        <span className="eyebrow">{offer.category === "package" ? "AUTOMATION PACKAGE" : offer.category === "industry" ? "INDUSTRY AUTOMATION" : "AI AUTOMATION WORKER"}</span>
        <h2 style={{ marginBottom: ".45rem" }}>{offer.name}</h2>
        <p className="small" style={{ minHeight: 58 }}>{offer.description}</p>
        <div style={{ margin: ".8rem 0 1rem" }}>
          <strong style={{ fontSize: "1.55rem" }}><Money value={offer.setupAud!} /> setup</strong>
          <div className="small">+ <Money value={offer.monthlyAud!} /> / month</div>
          <div className="small" style={{ marginTop: ".35rem" }}>First checkout: <strong><Money value={first!} /></strong> AUD, then <Money value={offer.monthlyAud!} /> monthly.</div>
        </div>
        <div className="revenue-stack" style={{ marginBottom: "1rem" }}>
          {offer.features.map((feature) => <div key={feature}><span>✓</span><strong>{feature}</strong></div>)}
        </div>
        <a href={offer.paymentUrl!} className="button primary" style={{ marginTop: "auto", textAlign: "center" }}>Buy securely with Stripe</a>
      </article>
    );
  };

  return (
    <main className="container" style={{ paddingTop: "2.5rem", paddingBottom: "5rem" }}>
      <section className="marketplace-neon-hero" style={{ marginBottom: "1.35rem" }}>
        <div>
          <span className="eyebrow">CQA AUTOMATION MARKETPLACE</span>
          <h1>Buy the business outcome. CQA builds the automation behind it.</h1>
          <p>Choose a ready-to-deploy automation, pay securely through Stripe, then complete your implementation brief. The setup fee is charged once; the monthly fee keeps the live automation supported and maintained.</p>
          <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap" }}>
            <a href="#packages" className="button primary">View Automation Packages</a>
            <Link href="/contact" className="button ghost">Request a Custom Build</Link>
          </div>
        </div>
        <div className="marketplace-live-panel"><span>LIVE CHECKOUT</span><strong>10</strong><small>automation offers</small></div>
      </section>

      <section className="grid grid-3" style={{ marginBottom: "1.35rem" }}>
        <article className="glass-card" style={{ padding: "1rem" }}><span className="eyebrow">01 · CHOOSE</span><h3>Pick the job to automate</h3><p className="small">Select a packaged system or specialist AI automation worker.</p></article>
        <article className="glass-card" style={{ padding: "1rem" }}><span className="eyebrow">02 · PAY</span><h3>Secure Stripe checkout</h3><p className="small">The first payment includes setup plus month one. Future invoices contain the monthly subscription only.</p></article>
        <article className="glass-card" style={{ padding: "1rem" }}><span className="eyebrow">03 · IMPLEMENT</span><h3>CQA configures the workflow</h3><p className="small">We connect the agreed tools, configure the workflow and prepare it for your business.</p></article>
      </section>

      <section id="packages" style={{ paddingTop: "1rem" }}>
        <span className="eyebrow">CORE PACKAGES</span>
        <h2>Scale from one automation to an AI operations layer.</h2>
        <div className="grid grid-3" style={{ marginTop: "1rem" }}>{packages.map((offer, index) => renderOffer(offer, index === 1))}</div>
      </section>

      <section style={{ paddingTop: "3.5rem" }}>
        <span className="eyebrow">SPECIALIST AUTOMATIONS</span>
        <h2>Add only the operational capacity your business needs.</h2>
        <div className="grid grid-2" style={{ marginTop: "1rem" }}>{specialist.map((offer) => renderOffer(offer))}</div>
      </section>

      {custom ? (
        <section className="final-panel" style={{ marginTop: "2rem" }}>
          <div>
            <span className="eyebrow">CUSTOM AUTOMATION SYSTEM</span>
            <h2>{custom.name}</h2>
            <p>{custom.description}</p>
            <p className="small"><strong>AUD $2,500–$7,500+ setup · $299–$799+/month</strong> depending on scope, integrations and support requirements.</p>
          </div>
          <Link href="/contact" className="button primary">Request a Custom Quote</Link>
        </section>
      ) : null}

      <section className="glass-card" style={{ padding: "1.25rem", marginTop: "1.25rem" }}>
        <span className="eyebrow">DATA & PLATFORM RESPONSIBILITY</span>
        <p className="small">Automations that collect third-party data are configured only for sources and access methods the customer is permitted to use. CQA does not position bypassing access controls or prohibited scraping as a product feature.</p>
      </section>
    </main>
  );
}
