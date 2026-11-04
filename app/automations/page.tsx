import Link from "next/link";
import { CQA_AUTOMATION_OFFERS, firstPaymentAud, type CqaAutomationOffer } from "@/lib/cqa-automation-catalog";
import styles from "./automations.module.css";

function Money({ value }: { value: number }) {
  return <>{new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(value)}</>;
}
export const metadata = {
  title: "CQA Business Automations | Creative Quality Australia",
  description: "Compare CQA business automation packages and specialist AI workers, with clear setup and monthly pricing in AUD."
};
const contact = "/contact";
const brief = "/contact?service=automation-implementation";
function Confirm({ children }: { children?: React.ReactNode }) {
  return <>{children ? <>{children} </> : null}<Link href={contact}>Contact CQA to confirm</Link>.</>;
}

function OfferCard({ offer }: { offer: CqaAutomationOffer }) {
  const first = firstPaymentAud(offer);
  if (offer.setupAud === null || offer.monthlyAud === null || first === null || !offer.paymentUrl) return null;
  return <article className={styles.offer} aria-labelledby={"offer-" + offer.id}>
    <span className={styles.eyebrow}>{offer.category === "package" ? "CORE PACKAGE" : offer.category === "industry" ? "INDUSTRY SPECIALIST" : "SPECIALIST WORKER"}</span>
    <h3 id={"offer-" + offer.id}>{offer.name}</h3>
    <p className={styles.description}>{offer.id === "automation_starter" ? "One agreed business workflow, built and connected around a focused job in your business." : offer.description}</p>
    <dl className={styles.pricing}>
      <div><dt>One-time setup</dt><dd><Money value={offer.setupAud} /> <small>AUD</small></dd></div>
      <div><dt>Monthly service</dt><dd><Money value={offer.monthlyAud} /> <small>AUD / month</small></dd></div>
    </dl>
    <ul className={styles.features}>{offer.features.map(feature => <li key={feature}>{feature}</li>)}</ul>
    <div className={styles.checkout}>
      <p><span>First payment</span><strong><Money value={first} /> <small>AUD</small></strong></p>
      <p className={styles.chargeNote}><Money value={offer.setupAud} /> setup + <Money value={offer.monthlyAud} /> for month one. Then <Money value={offer.monthlyAud} /> AUD each month.</p>
      <a href={offer.paymentUrl} className={styles.primary} aria-label={"Continue to Stripe for " + offer.name}>Continue to Stripe <span aria-hidden="true">↗</span></a>
      <Link className={styles.cardQuestion} href={"/contact?service=" + offer.id}>Ask about this offer</Link>
    </div>
  </article>;
}

export default function AutomationsPage() {
  const packages = CQA_AUTOMATION_OFFERS.filter(item => item.category === "package");
  const specialists = CQA_AUTOMATION_OFFERS.filter(item => item.category === "worker" || item.category === "industry");
  const custom = CQA_AUTOMATION_OFFERS.find(item => item.category === "custom");
  const scope: Record<string, { fit: string; workflow: string; support: string }> = {
    automation_starter: { fit: "One focused business workflow", workflow: "1 agreed automation", support: "Ongoing monitoring and maintenance" },
    automation_pro: { fit: "Connected sales, marketing or operations workflows", workflow: "Up to 3 connected automations", support: "Priority configuration; ongoing monitoring and maintenance" },
    ai_business_operations: { fit: "AI workers and multi-step business operations", workflow: "AI worker system, multi-step automations and integrations", support: "Priority implementation support" }
  };

  return <main className={"container " + styles.page}>
    <section className={styles.hero} aria-labelledby="automation-heading">
      <div className={styles.heroCopy}>
        <span className={styles.eyebrow}>CREATIVE QUALITY AUSTRALIA · BUSINESS AUTOMATIONS</span>
        <h1 id="automation-heading">Buy the business outcome. CQA builds the automation behind it.</h1>
        <p className={styles.lead}>For business owners and teams who want less manual work. Choose a core automation package or a specialist AI worker; CQA configures the agreed workflow and business tools.</p>
        <p className={styles.heroNote}>After checkout, send your workflow requirements through the implementation brief contact form. Confirm your scope, tool compatibility and delivery timing with CQA before purchasing.</p>
        <div className={styles.actions}>
          <a href="#packages" className={styles.primary}>View Automation Packages <span aria-hidden="true">↓</span></a>
          <Link href={contact} className={styles.secondary}>Request a Custom Build</Link>
        </div>
      </div>
      <aside className={styles.heroAside} aria-label="How the pricing works">
        <span className={styles.eyebrow}>CLEAR FROM THE START</span>
        <h2>A setup fee.<br />A monthly service.</h2>
        <p>See both charges and your first-payment total before you continue to Stripe.</p>
        <div className={styles.asideLine}><span>Core packages</span><strong>{packages.length}</strong></div>
        <div className={styles.asideLine}><span>Specialist workers</span><strong>{specialists.length}</strong></div>
        <a href="#how-it-works" className={styles.textLink}>See the implementation steps →</a>
      </aside>
    </section>

    <section id="how-it-works" className={styles.section} aria-labelledby="implementation-heading">
      <div className={styles.sectionHeader}><span className={styles.eyebrow}>FROM REQUIREMENT TO WORKFLOW</span><h2 id="implementation-heading">Know what happens next.</h2></div>
      <ol className={styles.steps}>
        <li><span>01</span><h3>Agree the right scope</h3><p>Choose an offer and discuss the workflow, tools and access your project needs.</p></li>
        <li><span>02</span><h3>Review the charges</h3><p>Your first payment is the one-time setup fee plus month one. Check the recurring amount before continuing to Stripe.</p></li>
        <li><span>03</span><h3>Send your brief</h3><p>Use the <Link href={brief}>implementation brief contact form</Link> to share business details, the workflow and systems you want connected. Keep your payment reference for matching.</p></li>
      </ol>
      <p className={styles.quietNote}>Customer launch checks are still in progress. Please discuss project readiness and implementation arrangements with CQA before purchasing.</p>
    </section>

    <section id="packages" className={styles.section} aria-labelledby="packages-heading">
      <div className={styles.sectionHeader}><span className={styles.eyebrow}>CORE PACKAGES</span><h2 id="packages-heading">Choose the scope your business needs.</h2><p>Starter covers one agreed workflow. Pro connects up to three. AI Business Operations brings AI workers and multi-step workflows together. Exact integrations and implementation details need to be agreed with CQA.</p></div>
      <p className={styles.currencyNote}>All displayed prices are in AUD. <Link href={contact}>Confirm GST treatment and applicable terms with CQA before checkout.</Link></p>
      <div className={styles.packages}>{packages.map(offer => <OfferCard offer={offer} key={offer.id} />)}</div>
    </section>

    <section className={styles.section} aria-labelledby="comparison-heading">
      <div className={styles.sectionHeader}><span className={styles.eyebrow}>COMPARE THE CORE OPTIONS</span><h2 id="comparison-heading">One workflow, connected workflows, or an operations layer.</h2></div>
      <div className={styles.comparison}>{packages.map(offer => <article key={offer.id}>
        <h3>{offer.name}</h3>
        <dl><div><dt>Best fit</dt><dd>{scope[offer.id].fit}</dd></div><div><dt>Workflow scope</dt><dd>{scope[offer.id].workflow}</dd></div><div><dt>Service listed</dt><dd>{scope[offer.id].support}</dd></div><div><dt>Setup / monthly</dt><dd><Money value={offer.setupAud!} /> / <Money value={offer.monthlyAud!} /> AUD</dd></div><div><dt>First payment</dt><dd><Money value={firstPaymentAud(offer)!} /> AUD</dd></div></dl>
      </article>)}</div>
      <p className={styles.quietNote}>Monitoring frequency, support response times, specific integrations and delivery dates are confirmed with CQA; they are not specified by these package summaries.</p>
    </section>

    <section id="specialists" className={styles.section} aria-labelledby="specialists-heading">
      <div className={styles.sectionHeader}><span className={styles.eyebrow}>SPECIALIST WORKERS</span><h2 id="specialists-heading">A defined job, rather than a general workflow package.</h2><p>Choose a specialist when its listed purpose matches the work you need done. Unlike Starter’s agreed workflow, each specialist below has a defined focus—such as lead collection, content or follow-up. Confirm how it fits your tools before checkout.</p></div>
      <div className={styles.specialists}>{specialists.map(offer => <OfferCard offer={offer} key={offer.id} />)}</div>
    </section>

    {custom ? <section className={styles.custom} aria-labelledby="custom-heading"><div><span className={styles.eyebrow}>CUSTOM IMPLEMENTATION</span><h2 id="custom-heading">Need a system scoped around your business?</h2><p>{custom.description}</p><p className={styles.customPrice}><strong>AUD $2,500–$7,500+ setup</strong><br />$299–$799+ AUD / month</p><p className={styles.quietNote}>Indicative existing range. Your setup, recurring charge and first-payment total are confirmed in your custom quote.</p></div><Link href={contact} className={styles.primary}>Request a Custom Quote</Link></section> : null}

    <section className={styles.section} aria-labelledby="faq-heading">
      <div className={styles.sectionHeader}><span className={styles.eyebrow}>BEFORE YOU BUY</span><h2 id="faq-heading">Your implementation questions.</h2></div>
      <div className={styles.faq}>
        <details><summary>How does implementation work?</summary><p>Choose an offer, confirm the requirements with CQA and review the Stripe charges. After checkout, send your business details, workflow requirements and systems through the <Link href={brief}>implementation brief contact form</Link>. CQA configures the agreed workflow; scope and timing should be confirmed before purchase.</p></details>
        <details><summary>What information do I need to provide?</summary><p>Share your business name, contact details, the job you want automated and the systems you want connected. Include a receipt or payment reference if you have purchased. Do not put passwords, API keys or card details in the contact form.</p></details>
        <details><summary>Which integrations are supported?</summary><p><Confirm>Compatibility depends on the tools and access your workflow needs.</Confirm> Tell CQA the systems you use before purchasing.</p></details>
        <details><summary>How long will implementation take?</summary><p><Confirm>The listed packages do not specify a delivery time.</Confirm> Agree your expected delivery date before checkout.</p></details>
        <details><summary>Who owns the automation?</summary><p><Confirm>Ownership, licensing, export and account-access arrangements need to be agreed for your project.</Confirm></p></details>
        <details><summary>How do cancellation and refunds work, and what happens afterward?</summary><p><Confirm>Confirm cancellation notice, refund terms, any fees, ongoing access and offboarding before purchasing.</Confirm></p></details>
        <details><summary>Are third-party software costs included?</summary><p><Confirm>Ask which software subscriptions or usage costs your workflow requires, who pays them and whether they are included in your quote.</Confirm></p></details>
        <details><summary>How are data privacy and security handled?</summary><p>Third-party data workflows must use sources and access methods you are permitted to use. <Confirm>Discuss required access, data handling, retention and security arrangements for your project before sharing business data.</Confirm></p></details>
      </div>
    </section>

    <section className={styles.help} aria-labelledby="help-heading"><div><span className={styles.eyebrow}>LET’S FIND THE RIGHT SCOPE</span><h2 id="help-heading">Not sure which option is right?</h2><p>Describe the manual work you want to remove and the tools you already use. Discuss fit, scope, costs and implementation before deciding.</p></div><Link href={contact} className={styles.primary}>Discuss your project</Link></section>
  </main>;
}
