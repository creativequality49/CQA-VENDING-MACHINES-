import Link from "next/link";
import VendingConsole from "@/components/VendingConsole";
import { CQA_AUTOMATION_OFFERS, firstPaymentAud } from "@/lib/cqa-automation-catalog";
import { isCqaLiveCatalogCheckoutAllowed } from "@/lib/cqa-launch-gate";

function Money({ value }: { value: number }) {
  return <>{new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(value)}</>;
}

export const metadata = {
  title: "CQA Business Automations | Creative Quality Australia",
  description: "Explore CQA business automation plans and register interest in assisted early access."
};

export default function AutomationsPage() {
  const launchApproved = isCqaLiveCatalogCheckoutAllowed();
  const packages = CQA_AUTOMATION_OFFERS.filter((item) => item.category === "package");
  const specialist = CQA_AUTOMATION_OFFERS.filter((item) => item.category === "worker" || item.category === "industry");
  const custom = CQA_AUTOMATION_OFFERS.find((item) => item.category === "custom");

  const renderOffer = (offer: (typeof CQA_AUTOMATION_OFFERS)[number], featured = false) => {
    const first = firstPaymentAud(offer);
    return (
      <article className={`automation-offer${featured ? " automation-offer-featured" : ""}`} key={offer.id} id={offer.id}>
        <span className="eyebrow">{offer.category === "package" ? "AUTOMATION PACKAGE" : offer.category === "industry" ? "INDUSTRY AUTOMATION" : "AI AUTOMATION WORKER"}</span>
        <h3>{offer.name}</h3>
        <p className="automation-description">{offer.description}</p>
        <div className="automation-price">
          <strong><Money value={offer.setupAud!} /> setup</strong>
          <div className="small">+ <Money value={offer.monthlyAud!} /> / month</div>
          <div className="automation-first-payment">{launchApproved ? "First checkout:" : "Proposed first payment:"} <strong><Money value={first!} /></strong> AUD, then <Money value={offer.monthlyAud!} /> monthly{launchApproved ? "." : " after launch approval."}</div>
        </div>
        <ul className="automation-features">
          {offer.features.map((feature) => <li key={feature}><span aria-hidden="true">✓</span>{feature}</li>)}
        </ul>
        {launchApproved ? <a href={offer.paymentUrl!} className="button primary automation-offer-action">Buy securely with Stripe</a> : <Link href="/founding-customers" className="button primary automation-offer-action">Register early interest</Link>}
      </article>
    );
  };

  return (
    <main className="container cqa-automation-page">
      <section className="automation-hero">
        <div>
          <span className="eyebrow">CQA AUTOMATION MARKETPLACE</span>
          <span className="automation-availability">{launchApproved ? "LIVE CHECKOUT" : "PRELAUNCH · PAYMENTS PAUSED"}</span>
          <h1>{launchApproved ? "Select your next business automation." : "Your next automation. One selection away."}</h1>
          <p>{launchApproved ? "Agree your workflow scope, tool compatibility and delivery timing with CQA, review the setup and monthly costs, then complete your implementation brief after confirmed payment." : "Customer launch is not yet approved. Automation purchases are paused while we verify delivery, payments and customer access. These are proposed offers; register your interest without paying or committing to a subscription."}</p>
          <div className="automation-actions">
            <a href="#packages" className="button primary">View Automation Packages</a>
            <Link href="/contact" className="button ghost">Request a Custom Build</Link>
          </div>
        </div>
        <VendingConsole label="CQA AUTOMATION MACHINE" items={[...packages, ...specialist].slice(0, 6).map((offer, index) => ({
          code: `${index < 3 ? "A" : "B"}${index % 3 + 1}`,
          title: offer.name,
          image: `/images/slots/${["tablet", "headphones", "camera", "bag", "watch", "sneaker"][index]}.svg`,
          description: offer.description,
          price: `$${offer.setupAud?.toLocaleString("en-AU")} setup + $${offer.monthlyAud}/mo AUD`,
          href: `#${offer.id}`
        }))}/>

      </section>

      <section className="automation-process" aria-label="How it works">
        <article><span className="eyebrow">01 · CHOOSE</span><h3>Pick the job to automate</h3><p className="small">Select a packaged system or specialist AI automation worker.</p></article>
        <article><span className="eyebrow">{launchApproved ? "02 · PAY" : "02 · REGISTER INTEREST"}</span><h3>{launchApproved ? "Secure Stripe checkout" : "No payment during prelaunch"}</h3><p className="small">{launchApproved ? "The first payment includes setup plus month one. Future invoices contain the monthly subscription only." : "Join the early-access list. We will confirm availability, scope and pricing before inviting you to purchase."}</p></article>
        <article><span className="eyebrow">03 · IMPLEMENT</span><h3>CQA configures the workflow</h3><p className="small">We connect the agreed tools, configure the workflow and prepare it for your business.</p></article>
      </section>

      <section id="packages" className="automation-section">
        <span className="eyebrow">CORE PACKAGES</span>
        <h2>Scale from one automation to an AI operations layer.</h2>
        <p className="small">Starter covers one agreed workflow. Pro connects up to three automations. Specialist workers below have a defined job, such as lead qualification or follow-up. Confirm scope, tool compatibility and delivery timing with CQA.</p>
        <div className="automation-offers automation-packages">{packages.map((offer, index) => renderOffer(offer, index === 1))}</div>
      </section>

      <section className="automation-section">
        <span className="eyebrow">SPECIALIST AUTOMATIONS</span>
        <h2>Add only the operational capacity your business needs.</h2>
        <div className="automation-offers automation-specialists">{specialist.map((offer) => renderOffer(offer))}</div>
      </section>

      {custom ? (
        <section className="automation-custom">
          <div>
            <span className="eyebrow">CUSTOM AUTOMATION SYSTEM</span>
            <h2>{custom.name}</h2>
            <p>{custom.description}</p>
            <p className="small"><strong>AUD $2,500–$7,500+ setup · $299–$799+/month</strong> depending on scope, integrations and support requirements.</p>
          </div>
          <Link href="/contact" className="button primary">Request a Custom Quote</Link>
        </section>
      ) : null}

      <section className="glass-card" aria-labelledby="automation-comparison" style={{ padding: "1.25rem", marginTop: "2rem" }}>
        <h2 id="automation-comparison">Compare the core packages</h2>
        <div className="grid grid-3">{packages.map((offer) => <article key={offer.id}>
          <h3>{offer.name}</h3><p className="small">{offer.id === "automation_starter" ? "One agreed workflow" : offer.id === "automation_pro" ? "Up to three connected automations" : "AI workers, integrations and multi-step workflows"}</p>
          <p className="small">Setup: <Money value={offer.setupAud!} /> AUD<br/>Monthly: <Money value={offer.monthlyAud!} /> AUD<br/>{launchApproved ? "First payment" : "Proposed first payment"}: <Money value={firstPaymentAud(offer)!} /> AUD</p>
        </article>)}</div>
        <p className="small">Monitoring frequency, support response times, integration costs and delivery dates must be agreed for your project.</p>
      </section>
      <section aria-labelledby="automation-faq" style={{ marginTop: "2rem" }}>
        <h2 id="automation-faq">Your implementation questions</h2>
        {[
          ["How does implementation work?", "Discuss the workflow and tools with CQA, agree the scope and review the charges before purchase. After a confirmed purchase, send your implementation brief and payment reference."],
          ["What information should I provide?", "Your business details, chosen package, desired outcome, workflow and tools. Do not send passwords, API keys or card details through the contact form."],
          ["Which integrations are supported?", "Compatibility depends on the tools and permitted access your workflow requires. Confirm compatibility with CQA before committing."],
          ["How long will delivery take?", "Delivery timing is agreed for each project; these package summaries do not promise a universal turnaround."],
          ["Who owns the automation?", "Agree bespoke deliverables, configuration exports, licences, access and offboarding arrangements in your implementation brief."],
          ["How do cancellation and refunds work?", "Review the CQA refund policy and agree any project-specific terms before purchase. Contact support to request cancellation or discuss a service problem."],
          ["Are third-party costs included?", "Confirm required software subscriptions, usage charges and who pays them in your agreed scope before incurring extra costs."],
          ["How is business data handled?", "Review the privacy policy and agree required access, retention and security arrangements before sharing business data. Use only authorised sources and access methods."]
        ].map(([question, answer]) => <details key={question} className="glass-card" style={{ padding: "1rem", marginBottom: ".7rem" }}><summary style={{ cursor: "pointer", fontWeight: 700 }}>{question}</summary><p className="small">{answer}</p></details>)}
        <p className="small"><Link href="/terms">Service terms</Link> · <Link href="/refund-policy">Refunds and cancellation</Link> · <Link href="/privacy">Privacy</Link> · <Link href="/contact?service=automation-implementation">Discuss your implementation</Link></p>
      </section>

      <section className="automation-responsibility">
        <span className="eyebrow">DATA & PLATFORM RESPONSIBILITY</span>
        <p className="small">Automations that collect third-party data are configured only for sources and access methods the customer is permitted to use. CQA does not position bypassing access controls or prohibited scraping as a product feature.</p>
      </section>
    </main>
  );
}
