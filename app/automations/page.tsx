import Link from "next/link";
import { CQA_AUTOMATION_OFFERS, firstPaymentAud } from "@/lib/cqa-automation-catalog";

function Money({ value }: { value: number }) {
  return <>{new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(value)}</>;
}

export const metadata = {
  title: "CQA Business Automations | Creative Quality Australia",
  description: "Compare CQA automation packages and specialist AI workers. Review setup and monthly pricing, then discuss implementation with CQA."
};

const contactHref = "/contact?service=automation-project";
const faqs = [
  {
    question: "How does implementation work?",
    answer: "Choose the package or specialist worker that best matches your need and complete Stripe checkout. The current post-checkout page directs you to contact CQA with your business details, workflow requirements and systems to connect. CQA can then scope implementation against the option purchased."
  },
  {
    question: "What information should I provide?",
    answer: "The post-checkout instructions ask for your business details, the workflow requirements and the systems you want connected. Contact CQA if you want to confirm fit before checkout."
  },
  {
    question: "Which integrations are supported?",
    answer: null
  },
  {
    question: "How long will delivery take?",
    answer: null
  },
  {
    question: "Who owns the automation after it is built?",
    answer: null
  },
  {
    question: "Can I cancel, and what happens afterward?",
    answer: null
  },
  {
    question: "Are third-party software costs included?",
    answer: null
  },
  {
    question: "How are my data and credentials protected?",
    answer: null
  }
];

export default function AutomationsPage() {
  const packages = CQA_AUTOMATION_OFFERS.filter((item) => item.category === "package");
  const specialist = CQA_AUTOMATION_OFFERS.filter((item) => item.category === "worker" || item.category === "industry");
  const custom = CQA_AUTOMATION_OFFERS.find((item) => item.category === "custom");

  const renderOffer = (offer: (typeof CQA_AUTOMATION_OFFERS)[number]) => {
    const first = firstPaymentAud(offer);
    return (
      <article className="glass-card" key={offer.id} style={{ padding: "1.35rem", display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span className="eyebrow">{offer.category === "package" ? "CORE PACKAGE" : offer.category === "industry" ? "SPECIALIST · INDUSTRY" : "SPECIALIST · AI WORKER"}</span>
        <h3 style={{ marginBottom: ".45rem" }}>{offer.name}</h3>
        <p className="small">{offer.description}</p>
        <dl className="small" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: ".45rem .75rem", margin: ".65rem 0 1rem" }}>
          <dt>One-time setup</dt><dd style={{ margin: 0, color: "var(--text)" }}><strong><Money value={offer.setupAud!} /> AUD</strong></dd>
          <dt>Monthly charge</dt><dd style={{ margin: 0, color: "var(--text)" }}><strong><Money value={offer.monthlyAud!} /> AUD / month</strong></dd>
          <dt>First payment</dt><dd style={{ margin: 0, color: "var(--text)" }}><strong><Money value={first!} /> AUD</strong></dd>
        </dl>
        <ul className="small" style={{ paddingLeft: "1.2rem", marginTop: 0, marginBottom: "1rem" }}>
          {offer.features.map((feature) => <li key={feature} style={{ marginBottom: ".35rem" }}>{feature}</li>)}
        </ul>
        <p className="small" style={{ fontSize: ".85rem", marginTop: "auto", marginBottom: ".7rem" }}>
          Checkout charges <strong><Money value={offer.setupAud!} /> AUD once + <Money value={offer.monthlyAud!} /> AUD for month one</strong> (<Money value={first!} /> AUD total), then <Money value={offer.monthlyAud!} /> AUD each month. Confirm GST treatment with CQA before purchase.
        </p>
        {offer.paymentUrl ? (
          <a href={offer.paymentUrl} className="button primary" style={{ minHeight: 48, textAlign: "center" }}>
            Continue to Stripe · <Money value={first!} /> AUD today
          </a>
        ) : <Link href={contactHref} className="button primary" style={{ minHeight: 48, textAlign: "center" }}>Discuss your project</Link>}
      </article>
    );
  };

  return (
    <main className="container" style={{ paddingTop: "2.5rem", paddingBottom: "5rem" }}>
      <section className="marketplace-neon-hero" style={{ marginBottom: "1.35rem" }}>
        <div>
          <span className="eyebrow">CQA AUTOMATIONS</span>
          <h1>Buy the business outcome. CQA builds the automation behind it.</h1>
          <p>For businesses ready to reduce repetitive work, CQA configures a focused workflow or specialist AI worker around the tools and requirements you agree together. Choose an option and pay through its existing Stripe checkout; after checkout, send CQA your business details, workflow requirements and systems to connect so implementation can be scoped.</p>
          <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap" }}>
            <a href="#packages" className="button primary" style={{ minHeight: 48 }}>View Automation Packages</a>
            <Link href={contactHref} className="button ghost" style={{ minHeight: 48 }}>Request a Custom Build</Link>
          </div>
        </div>
        <aside className="glass-card" aria-label="Checkout information" style={{ padding: "1rem", maxWidth: 250 }}>
          <span className="eyebrow">PRICING</span>
          <strong style={{ display: "block", fontSize: "1.15rem", margin: ".45rem 0" }}>AUD pricing shown upfront</strong>
          <p className="small" style={{ margin: 0 }}>Each fixed-price offer shows setup, monthly charge and the total due at first checkout.</p>
        </aside>
      </section>

      <section aria-label="How it works" className="grid grid-3" style={{ marginBottom: "1.35rem" }}>
        <article className="glass-card" style={{ padding: "1rem" }}><span className="eyebrow">01 · CHOOSE</span><h2 style={{ fontSize: "1.1rem" }}>Pick a defined outcome</h2><p className="small">Select a core package for an agreed workflow scope, or a specialist worker with a pre-defined job.</p></article>
        <article className="glass-card" style={{ padding: "1rem" }}><span className="eyebrow">02 · CHECK OUT</span><h2 style={{ fontSize: "1.1rem" }}>Review the first charge</h2><p className="small">The first payment combines the one-time setup fee and first month. The recurring amount is shown before you continue to Stripe.</p></article>
        <article className="glass-card" style={{ padding: "1rem" }}><span className="eyebrow">03 · BRIEF CQA</span><h2 style={{ fontSize: "1.1rem" }}>Share your requirements</h2><p className="small">After checkout, contact CQA with your business, workflow and connected-system details to scope implementation.</p></article>
      </section>

      <section aria-labelledby="packages" style={{ paddingTop: "1rem", scrollMarginTop: 100 }}>
        <span className="eyebrow">CORE PACKAGES</span>
        <h2 id="packages">Choose the level of workflow scope</h2>
        <p className="small" style={{ maxWidth: 760 }}>Automation Starter is for one agreed, focused workflow. A specialist worker is a pre-defined role such as lead qualification or customer follow-up. Pro covers up to three connected automations; AI Business Operations combines workers, integrations and automations.</p>
        <div className="grid grid-3" style={{ marginTop: "1rem" }}>{packages.map(renderOffer)}</div>
      </section>

      <section aria-labelledby="compare" style={{ paddingTop: "3rem" }}>
        <span className="eyebrow">PACKAGE COMPARISON</span>
        <h2 id="compare">Compare the core packages</h2>
        <div className="glass-card" style={{ overflowX: "auto", marginTop: "1rem" }}>
          <table style={{ width: "100%", minWidth: 620, borderCollapse: "collapse", textAlign: "left" }}>
            <caption className="small" style={{ textAlign: "left", padding: "1rem" }}>Scope and pricing from the current CQA automation catalogue</caption>
            <thead><tr>{["", "Automation Starter", "Automation Pro", "AI Business Operations"].map((label) => <th key={label} scope="col" style={{ padding: ".8rem", borderBottom: "1px solid var(--border)" }}>{label}</th>)}</tr></thead>
            <tbody>
              <tr><th scope="row" style={{ padding: ".8rem" }}>Scope</th><td style={{ padding: ".8rem" }}>One agreed focused workflow</td><td style={{ padding: ".8rem" }}>Up to 3 connected automations</td><td style={{ padding: ".8rem" }}>Connected AI operations layer</td></tr>
              <tr><th scope="row" style={{ padding: ".8rem" }}>Setup</th><td style={{ padding: ".8rem" }}>AUD $497</td><td style={{ padding: ".8rem" }}>AUD $897</td><td style={{ padding: ".8rem" }}>AUD $1,997</td></tr>
              <tr><th scope="row" style={{ padding: ".8rem" }}>Monthly</th><td style={{ padding: ".8rem" }}>AUD $99</td><td style={{ padding: ".8rem" }}>AUD $249</td><td style={{ padding: ".8rem" }}>AUD $449</td></tr>
              <tr><th scope="row" style={{ padding: ".8rem" }}>First payment</th><td style={{ padding: ".8rem" }}>AUD $596</td><td style={{ padding: ".8rem" }}>AUD $1,146</td><td style={{ padding: ".8rem" }}>AUD $2,446</td></tr>
            </tbody>
          </table>
        </div>
        <p className="small">A specialist worker is separately scoped around a named, pre-defined job. Its current price is shown on its offer card.</p>
      </section>

      <section aria-labelledby="specialists" style={{ paddingTop: "3rem" }}>
        <span className="eyebrow">SPECIALIST WORKERS</span>
        <h2 id="specialists">Choose a worker for a specific job</h2>
        <p className="small" style={{ maxWidth: 760 }}>These are pre-defined offers. They are different from Automation Starter, which is scoped around one workflow agreed with CQA. Check with CQA to confirm that your existing tools and requirements fit an offer.</p>
        <div className="grid grid-2" style={{ marginTop: "1rem" }}>{specialist.map(renderOffer)}</div>
      </section>

      {custom ? (
        <section className="final-panel" style={{ marginTop: "2rem" }}>
          <div>
            <span className="eyebrow">CUSTOM AUTOMATION SYSTEM · QUOTE REQUIRED</span>
            <h2>{custom.name}</h2>
            <p>{custom.description}</p>
            <p className="small"><strong>AUD $2,500–$7,500+ setup · AUD $299–$799+/month</strong> as currently displayed on the CQA page. Confirm scope, final pricing and GST treatment with CQA. No fixed-price Stripe checkout is listed for this option.</p>
          </div>
          <Link href={contactHref} className="button primary" style={{ minHeight: 48 }}>Request a Custom Quote</Link>
        </section>
      ) : null}

      <section aria-labelledby="faq" style={{ paddingTop: "3rem" }}>
        <span className="eyebrow">BEFORE YOU BUY</span>
        <h2 id="faq">Questions about implementation</h2>
        <div style={{ display: "grid", gap: ".7rem", marginTop: "1rem" }}>
          {faqs.map(({ question, answer }) => (
            <details className="glass-card" key={question} style={{ padding: "1rem 1.15rem" }}>
              <summary style={{ cursor: "pointer", fontWeight: 750, minHeight: 32 }}>{question}</summary>
              <p className="small" style={{ marginBottom: 0 }}>{answer || <>Contact CQA to confirm. <Link href={contactHref} style={{ color: "var(--pink)", textDecoration: "underline", textUnderlineOffset: 3 }}>Ask CQA about this</Link>.</>}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="glass-card" aria-labelledby="gst" style={{ padding: "1.25rem", marginTop: "1.5rem" }}>
        <span className="eyebrow">PRICE AND CHECKOUT NOTES</span>
        <h2 id="gst" style={{ fontSize: "1.2rem" }}>Confirm GST treatment before purchase</h2>
        <p className="small">The project catalogue records prices in AUD but does not confirm whether GST is included. Contact CQA to confirm the GST treatment and the final amount before buying.</p>
        <p className="small">The project contains an automation post-checkout page that directs customers to contact CQA with an implementation brief. The Stripe payment links themselves are external links; their success redirect and any Stripe-side automation were not verified here. Checkout will show the payment details before you pay.</p>
        <p className="small">No dedicated automation terms, cancellation or refund policy pages, or confirmed booking link were found in the project. Ask CQA to confirm those terms before purchase.</p>
      </section>

      <section className="final-panel" style={{ marginTop: "1.5rem" }}>
        <div>
          <span className="eyebrow">NEED HELP CHOOSING?</span>
          <h2>Not sure which option fits your workflow?</h2>
          <p>Tell CQA what you want to automate and which systems you use. Ask about fit, scope, GST, delivery, cancellation, ownership and third-party costs before checkout.</p>
        </div>
        <Link href={contactHref} className="button primary" style={{ minHeight: 48 }}>Discuss your project</Link>
      </section>

      <section className="glass-card" style={{ padding: "1.25rem", marginTop: "1.25rem" }}>
        <span className="eyebrow">DATA & PLATFORM RESPONSIBILITY</span>
        <p className="small">Automations that collect third-party data are configured only for sources and access methods the customer is permitted to use. CQA does not position bypassing access controls or prohibited scraping as a product feature.</p>
      </section>
    </main>
  );
}
