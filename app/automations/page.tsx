import Link from "next/link";
import { CQA_AUTOMATION_OFFERS, firstPaymentAud } from "@/lib/cqa-automation-catalog";

function Money({ value }: { value: number }) {
  return <>{new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(value)}</>;
}

export const metadata = {
  title: "CQA Business Automations | Creative Quality Australia",
  description: "Explore CQA automation packages, compare setup and monthly costs, and discuss implementation requirements."
};

export default function AutomationsPage() {
  const packages = CQA_AUTOMATION_OFFERS.filter((item) => item.category === "package");
  const specialist = CQA_AUTOMATION_OFFERS.filter((item) => item.category === "worker" || item.category === "industry");
  const custom = CQA_AUTOMATION_OFFERS.find((item) => item.category === "custom");

  const renderOffer = (offer: (typeof CQA_AUTOMATION_OFFERS)[number], featured = false) => {
    const first = firstPaymentAud(offer);
    return (
      <article className="glass-card" key={offer.id} style={{ padding: "1.35rem", display: "flex", flexDirection: "column", borderColor: featured ? "rgba(255,45,141,.55)" : undefined }}>
        <span className="eyebrow">{offer.category === "package" ? "AUTOMATION PACKAGE" : offer.category === "industry" ? "INDUSTRY AUTOMATION" : "AI AUTOMATION WORKER"}</span>
        <h2 style={{ marginBottom: ".45rem" }}>{offer.name}</h2>
        <p className="small" style={{ minHeight: 58 }}>{offer.description}</p>
        <div style={{ margin: ".8rem 0 1rem" }}>
          <strong style={{ fontSize: "1.55rem" }}><Money value={offer.setupAud!} /> setup</strong>
          <div className="small">+ <Money value={offer.monthlyAud!} /> / month</div>
          <div className="small" style={{ marginTop: ".35rem" }}>First payment (setup + first month): <strong><Money value={first!} /></strong>, then <Money value={offer.monthlyAud!} /> monthly.</div>
        </div>
        <div className="revenue-stack" style={{ marginBottom: "1rem" }}>
          {offer.features.map((feature) => <div key={feature}><span>✓</span><strong>{feature}</strong></div>)}
        </div>
        <p className="small">Scope and implementation requirements should be agreed with CQA. <Link href="/contact">Ask a question</Link> before purchasing if unsure.</p><a href={offer.paymentUrl!} className="button primary" style={{ marginTop: "auto", textAlign: "center" }}>Buy securely with Stripe</a>
      </article>
    );
  };

  return (
    <main className="container" style={{ paddingTop: "2.5rem", paddingBottom: "5rem" }}>
      <section className="marketplace-neon-hero" style={{ marginBottom: "1.35rem" }}>
        <div>
          <span className="eyebrow">CQA AUTOMATION MARKETPLACE</span>
          <h1>Buy the business outcome. CQA builds the automation behind it.</h1>
          <p>For business owners who want to reduce repetitive work: choose an automation package or specialist worker, review the setup and monthly costs, and provide CQA with your workflow requirements. CQA will confirm the implementation scope and connected systems. Contact CQA before paying if timing or integration compatibility is essential.</p>
          <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap" }}>
            <a href="#packages" className="button primary">View Automation Packages</a>
            <Link href="/contact" className="button ghost">Request a Custom Build</Link>
          </div>
        </div>
        <div className="marketplace-live-panel"><span>EXPLORE OPTIONS</span><strong>10</strong><small>priced automation offers</small></div>
      </section>

      <section className="grid grid-3" style={{ marginBottom: "1.35rem" }}>
        <article className="glass-card" style={{ padding: "1rem" }}><span className="eyebrow">01 · CHOOSE</span><h3>Pick the job to automate</h3><p className="small">Select a packaged system or specialist AI automation worker.</p></article>
        <article className="glass-card" style={{ padding: "1rem" }}><span className="eyebrow">02 · PAY</span><h3>Secure Stripe checkout</h3><p className="small">Displayed first-payment totals add the one-time setup charge and first month. Check the Stripe payment page before authorising payment.</p></article>
        <article className="glass-card" style={{ padding: "1rem" }}><span className="eyebrow">03 · IMPLEMENT</span><h3>CQA configures the workflow</h3><p className="small">After checkout, use the implementation brief contact link to provide your business details and systems. CQA must confirm the scope and delivery schedule.</p></article>
      </section>

      <section id="packages" style={{ paddingTop: "1rem" }}>
        <span className="eyebrow">CORE PACKAGES</span>
        <h2>Scale from one automation to an AI operations layer.</h2>
        <p className="small">Starter covers one agreed business workflow; specialist workers have a predefined purpose, such as lead finding or follow-up. Confirm your workflow and integrations with CQA before purchasing.</p><div className="grid grid-3" style={{ marginTop: "1rem" }}>{packages.map((offer, index) => renderOffer(offer, index === 1))}</div>
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


      <section className="glass-card" style={{ padding: "1.4rem", marginTop: "2rem", overflowX: "auto" }} aria-labelledby="compare-heading">
        <h2 id="compare-heading">Compare core packages</h2>
        <table style={{ width: "100%", minWidth: 480, borderCollapse: "collapse", textAlign: "left" }}>
          <caption className="small" style={{ textAlign: "left", marginBottom: ".75rem" }}>All figures in AUD. GST treatment is pending confirmation.</caption>
          <thead><tr><th scope="col">Package</th><th scope="col">Workflow scope</th><th scope="col">Setup</th><th scope="col">Monthly</th><th scope="col">First payment</th></tr></thead>
          <tbody>{packages.map((offer) => <tr key={offer.id}><th scope="row">{offer.name}</th><td>{offer.id === "automation_starter" ? "One agreed workflow" : offer.id === "automation_pro" ? "Up to three connected automations" : "Connected AI operations layer"}</td><td><Money value={offer.setupAud!} /></td><td><Money value={offer.monthlyAud!} /></td><td><Money value={firstPaymentAud(offer)!} /></td></tr>)}</tbody>
        </table>
      </section>
      <section className="glass-card" style={{ padding: "1.4rem", marginTop: "2rem" }} aria-labelledby="faq-heading">
        <h2 id="faq-heading">Frequently asked questions</h2>
        {[
          ["How does implementation work?", "Choose an offer and provide CQA with a brief describing your business, workflow and systems. Implementation scope must be confirmed with CQA."],
          ["What information do I need to provide?", "Your business details, the task to automate, existing tools and the outcome you need. Do not send passwords through the contact form."],
          ["Which integrations are supported?", "Compatibility depends on the systems and permitted access methods. Contact CQA to confirm before paying."],
          ["How long will delivery take?", "A delivery timeframe has not been confirmed. Contact CQA to confirm before paying."],
          ["Who owns the automation?", "Ownership and handover terms have not been confirmed. Contact CQA to confirm before paying."],
          ["Can I cancel, and what happens afterward?", "Cancellation terms and what happens to connected workflows and data need confirmation. Review the applicable terms and contact CQA before paying."],
          ["Are third-party software fees included?", "Any additional software or usage costs need confirmation for your chosen integrations. Contact CQA before paying."],
          ["How is business data protected?", "Only authorised data sources and access methods should be used. Review the privacy policy and contact CQA about your specific data and security requirements."],
          ["Do prices include GST?", "GST treatment has not been verified. Contact CQA to confirm before paying."]
        ].map(([question, answer]) => <details key={question} style={{ padding: ".8rem 0", borderBottom: "1px solid rgba(255,255,255,.16)" }}><summary style={{ cursor: "pointer", fontWeight: 700 }}>{question}</summary><p className="small">{answer} <Link href="/contact">Contact CQA</Link></p></details>)}
      </section>
      <section className="final-panel" style={{ marginTop: "2rem" }}><div><h2>Not sure which option is right?</h2><p>Discuss your workflow, integrations, scope and ongoing costs before committing.</p><p className="small">Review <Link href="/terms">terms</Link>, <Link href="/refund-policy">refund information</Link> and <Link href="/privacy">privacy information</Link> before checkout. Confirm cancellation and GST treatment with CQA.</p></div><Link href="/contact" className="button primary">Discuss your project</Link></section>
      <section className="glass-card" style={{ padding: "1.25rem", marginTop: "1.25rem" }}>
        <span className="eyebrow">DATA & PLATFORM RESPONSIBILITY</span>
        <p className="small">Automations that collect third-party data are configured only for sources and access methods the customer is permitted to use. CQA does not position bypassing access controls or prohibited scraping as a product feature.</p>
      </section>
    </main>
  );
}
