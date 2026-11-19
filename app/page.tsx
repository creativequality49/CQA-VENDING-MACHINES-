import Link from "next/link";
import Image from "next/image";
import StorefrontExample from "@/components/StorefrontExample";
import WorkerShowcase from "@/components/WorkerShowcase";
import MachineBuildDemo from "@/components/MachineBuildDemo";
import { CQA_PLANS } from "@/lib/cqa-marketplace";
import styles from "./home.module.css";

const steps = [
  ["01", "Choose your direction", "A creator brand, a local service or a business with more to offer. Start with the machine that fits."],
  ["02", "Make it unmistakably yours", "Add your business details, brand colours, logo and offers. See your preview before paying."],
  ["03", "Prepare the customer journey", "Review your offers, payment connection and delivery details in your owner workspace."],
  ["04", "Review, then publish", "Complete the launch requirements and publish your branded storefront when it is ready."],
];

export default function HomePage() {
  return <main className={styles.home}>
    <section className={`${styles.wrap} ${styles.hero}`}>
      <div className={styles.heroCopy}>
        <span className={styles.category}><i aria-hidden="true" /> Creative Quality Australia</span>
        <h1>Your ideas.<br />A storefront<br />of their own.</h1>
        <p className={styles.lead}>Bring your products, services and memberships together in a digital vending machine built around your brand.</p>
        <div className={styles.actions}><Link href="/onboarding?plan=pro" className={styles.primary}>Design my machine <span aria-hidden="true">→</span></Link><Link href="/machines" className={styles.textLink}>Explore the collection <span aria-hidden="true">→</span></Link></div>
        <p className={styles.micro}>Free design preview. No payment to explore.</p>
        <Link href="#machine-build-demo" className={styles.textLink}>Watch the example build <span aria-hidden="true">→</span></Link>
      </div>
      <figure className={styles.heroVisual}>
        <div className={styles.heroImage}><Image src="/images/activewear-vending-hero.png" alt="Illustrative CQA activewear storefront: an illuminated digital vending machine beside a model in black activewear" width={941} height={1672} sizes="(max-width: 760px) calc(100vw - 40px), 46vw" priority /></div>
        <span className={styles.imageLabel}>A CQA storefront concept</span>
        <figcaption><span>Your brand.<br /><strong>Made visible.</strong></span><Link href="/onboarding?plan=pro" aria-label="Create your own storefront preview">→</Link></figcaption>
      </figure>
    </section>
    <section className={`${styles.wrap} ${styles.introStrip}`} aria-label="What your workspace brings together"><p>One place.<br /><strong>Your kind of business.</strong></p><ul><li>Branded storefronts</li><li>A connected owner workspace</li><li>AI draft workers</li><li>Guided setup</li></ul></section>
    <section className={`${styles.wrap} ${styles.section}`}>
      <div className={styles.sectionHead}><div><span className={styles.sectionLabel}>01 / A place for your offers</span><h2>A clear home for<br />everything you do.</h2></div><p>Give customers something easy to explore, an offer they understand and a simple way to take the next step.</p></div>
      <div className={styles.audienceGrid}>
        <article className={styles.audienceCard}><div className={styles.preview}><StorefrontExample kind="beauty" /></div><div className={styles.audienceCopy}><span className={styles.category}>For service businesses</span><h3>Turn interest into<br />a conversation.</h3><p>Show treatments, services and memberships with a clear booking or enquiry path.</p><Link href="/onboarding?plan=pro" className={styles.textLink}>Design a business machine <span aria-hidden="true">→</span></Link></div></article>
        <article className={styles.audienceCard}><div className={styles.preview}><StorefrontExample kind="creator" /></div><div className={styles.audienceCopy}><span className={styles.category}>For creators & digital brands</span><h3>Give every good<br />idea a home.</h3><p>Organise digital offers, memberships and business enquiries around your own brand.</p><Link href="/onboarding?plan=starter" className={styles.textLink}>Design a creator machine <span aria-hidden="true">→</span></Link></div></article>
      </div>
      <p className={styles.micro}>Sample businesses and layouts shown. Digital checkout and customer launch remain subject to verification.</p>
    </section>
    <section className={styles.processBand}>
      <div className={`${styles.wrap} ${styles.section}`}>
        <div className={styles.sectionHead}><div><span className={styles.sectionLabel}>02 / From idea to preview</span><h2>A little direction.<br />A lot of possibility.</h2></div><Link href="/onboarding" className={styles.outline}>Start your free preview <span aria-hidden="true">→</span></Link></div>
        <div className={styles.steps}>{steps.map(([number, title, description]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p></article>)}</div>
        <div className={styles.darkDemo}><MachineBuildDemo /></div>
      </div>
    </section>
    <section className={`${styles.wrap} ${styles.section}`}>
      <div className={styles.sectionHead}><div><span className={styles.sectionLabel}>03 / Support behind the scenes</span><h2>A little less busywork.<br />More room to think.</h2></div><p>Prepare replies, follow-ups and marketing copy with three focused AI draft workers. You review the drafts and decide what happens next.</p></div>
      <div className={styles.workers}><WorkerShowcase compact /></div>
      <div className={styles.sectionEnd}><span>Business knowledge in. Drafts for your review out.</span><Link href="/workers" className={styles.textLink}>Meet your draft workers <span aria-hidden="true">→</span></Link></div>
    </section>
    <section className={`${styles.wrap} ${styles.section} ${styles.pricing}`}>
      <div className={styles.sectionHead}><div><span className={styles.sectionLabel}>04 / Clear plans, room to grow</span><h2>Start where you are.<br />Build what comes next.</h2></div><Link href="/pricing" className={styles.textLink}>Compare every inclusion <span aria-hidden="true">→</span></Link></div>
      <div className={styles.plans}>{CQA_PLANS.map(plan => <article key={plan.key} className={`${styles.plan} ${plan.key === "pro" ? styles.featured : ""}`}><span className={styles.planLabel}>{plan.key === "pro" ? "AI-assisted setup" : plan.key === "starter" ? "Your first storefront" : "Guided implementation"}</span><h3>{plan.name}</h3><p className={styles.price}>${plan.price}<small>AUD / month</small></p><p className={styles.planDetails}>{plan.slots}<br />{plan.setupMode}</p><ul>{plan.features.slice(1, 5).map(feature => <li key={feature}><span aria-hidden="true">✓</span>{feature}</li>)}</ul><p className={styles.fee}>{plan.fee}% CQA sale fee + Stripe processing</p><Link href={`/onboarding?plan=${plan.key}`} className={plan.key === "pro" ? styles.primary : styles.outline}>Preview {plan.name} <span aria-hidden="true">→</span></Link></article>)}</div>
    </section>
    <section className={`${styles.wrap} ${styles.section} ${styles.faq}`}>
      <div><span className={styles.sectionLabel}>05 / A few good questions</span><h2>Know what<br />comes next.</h2><Link href="/contact?service=support" className={styles.textLink}>Talk to CQA <span aria-hidden="true">→</span></Link></div>
      <div className={styles.questions}>
        <details><summary>Can I try the design before paying?</summary><p>Yes. Use the free questionnaire and preview to see an illustrative storefront with your business details. A preview is not a published or payment-enabled machine.</p></details>
        <details><summary>Will the AI workers run my business automatically?</summary><p>The receptionist, sales and marketing workers prepare drafts using your business information. Customer replies, publishing and commitments remain under your review.</p></details>
        <details><summary>Can customers pay and receive downloads now?</summary><p>Live customer payments remain paused while payment, private delivery and account-isolation verification is completed. Explore the preview or register for assisted early access.</p></details>
        <details><summary>What if I want help with setup?</summary><p>Request premium setup or custom automation support. We will confirm the scope with you before implementation. The optional Pro Launch Package is listed on the pricing page.</p></details>
      </div>
    </section>
    <section className={`${styles.wrap} ${styles.final}`}><div><span className={styles.category}>Your next chapter</span><h2>Good ideas deserve<br />a place to begin.</h2><p>Design first. Review the details. Take the next step with confidence.</p></div><div className={styles.finalActions}><Link href="/onboarding?plan=pro" className={styles.primary}>Create my free preview <span aria-hidden="true">→</span></Link><Link href="/founding-customers" className={styles.textLink}>Register for assisted early access <span aria-hidden="true">→</span></Link></div></section>
  </main>;
}
