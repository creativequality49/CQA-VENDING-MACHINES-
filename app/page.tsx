import Link from "next/link";
import MachineArtwork from "@/components/MachineArtwork";
import StorefrontExample from "@/components/StorefrontExample";
import WorkerShowcase from "@/components/WorkerShowcase";
import MachineBuildDemo from "@/components/MachineBuildDemo";
import { CQA_PLANS } from "@/lib/cqa-marketplace";

const steps = [
  ["01", "Choose your direction", "A creator brand, a local service or a business with more to offer. Start with the machine that fits."],
  ["02", "Make it unmistakably yours", "Add your business details, brand colours, logo and offers. See your preview before paying."],
  ["03", "Prepare your customer journey", "Review your offers, payment connection and delivery details in your owner workspace."],
  ["04", "Review, then publish", "Complete the launch requirements and publish your branded storefront when it is ready."]
];

export default function HomePage() {
  return <main className="studio-page">
    <section className="studio-hero studio-wrap">
      <div className="studio-hero-copy"><span className="studio-kicker">CREATIVE QUALITY AUSTRALIA</span><p className="studio-hero-pre">Your business deserves</p><h1>more than<br/> a link in bio<span>.</span></h1><p className="studio-lead">Your own digital vending machine. A branded place for your products, services and memberships—with AI draft workers to help behind the scenes.</p><div className="studio-actions"><Link href="/onboarding?plan=pro" className="studio-button">Design my machine <span aria-hidden="true">↗</span></Link><Link href="/machines" className="studio-button-secondary">Explore the collection</Link></div><p className="studio-micro">Free design preview · No payment to explore</p></div>
      <div className="studio-hero-visual"><div className="studio-visual-top"><span>CQA / DIGITAL VENDING OS</span><span>THE CONCEPT</span></div><MachineArtwork variant="scene" priority/><div className="studio-visual-caption"><span><b>Your brand. Your storefront.</b><small>Black glass. Illuminated offers. Built around your business.</small></span><span aria-hidden="true">↗</span></div></div>
    </section>
    <div className="studio-feature-strip"><div className="studio-wrap"><span>01 <b>Branded storefront</b></span><span>02 <b>Owner workspace</b></span><span>03 <b>AI draft workers</b></span><span>04 <b>Guided setup</b></span></div></div>

    <section className="studio-section studio-wrap">
      <div className="studio-section-head"><div><span className="studio-kicker">ONE PLATFORM. YOUR KIND OF BUSINESS.</span><h2>Make your next<br/>impression count.</h2></div><p>Give customers something clear to explore, an offer they understand and a simple way to take the next step.</p></div>
      <div className="studio-audience-grid">
        <article className="studio-audience"><StorefrontExample kind="beauty"/><div><span className="studio-kicker">FOR SERVICE BUSINESSES</span><h3>Turn interest into an enquiry.</h3><p>Show treatments, services and memberships with a clear booking or enquiry path.</p><Link href="/onboarding?plan=pro">Design a business machine ↗</Link></div></article>
        <article className="studio-audience"><StorefrontExample kind="creator"/><div><span className="studio-kicker">FOR CREATORS</span><h3>Give every offer a home.</h3><p>Organise digital offers, memberships and business enquiries around your own brand.</p><Link href="/onboarding?plan=starter">Design a creator machine ↗</Link></div></article>
      </div>
      <p className="studio-micro">Sample businesses and layouts shown. Digital checkout and customer launch remain subject to verification.</p>
    </section>

    <section className="studio-dark-band"><div className="studio-wrap studio-section"><div className="studio-section-head"><div><span className="studio-kicker">FROM FIRST IDEA TO YOUR FIRST PREVIEW</span><h2>Build with intention.<br/><em>See it take shape.</em></h2></div><Link href="/onboarding" className="studio-text-link">Start your free preview ↗</Link></div><div className="studio-steps">{steps.map(([number,title,description])=><article key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p></article>)}</div><MachineBuildDemo/></div></section>

    <section className="studio-section studio-wrap"><div className="studio-section-head"><div><span className="studio-kicker">A LITTLE MORE HEADSPACE</span><h2>Your business knowledge.<br/><em>Three focused workers.</em></h2></div><p>Prepare replies, follow-ups and marketing copy. You review the drafts and decide what happens next.</p></div><WorkerShowcase compact/><div className="studio-actions"><Link href="/workers" className="studio-button-secondary">Meet your draft workers ↗</Link></div></section>

    <section className="studio-section studio-wrap studio-plan-section"><div className="studio-section-head"><div><span className="studio-kicker">CLEAR PLANS. ROOM TO GROW.</span><h2>Choose your starting point.</h2></div><Link href="/pricing" className="studio-text-link">Compare every inclusion ↗</Link></div><div className="studio-plans">{CQA_PLANS.map(plan=><article key={plan.key} className={plan.key==="pro"?"studio-plan studio-plan-featured":"studio-plan"}><span className="studio-kicker">{plan.key==="pro"?"THE BUSINESS BUILDER":plan.key==="starter"?"YOUR FIRST MACHINE":"GUIDED IMPLEMENTATION"}</span><h3>{plan.name}</h3><p className="studio-price">${plan.price}<small> AUD / month</small></p><p>{plan.slots} · {plan.setupMode}</p><ul>{plan.features.slice(1,4).map(feature=><li key={feature}>{feature}</li>)}</ul><p className="studio-plan-fee">{plan.fee}% CQA sale fee + Stripe processing</p><Link href={`/onboarding?plan=${plan.key}`} className={plan.key==="pro"?"studio-button":"studio-button-secondary"}>Preview {plan.name} ↗</Link></article>)}</div></section>

    <section className="studio-section studio-wrap studio-faq"><div><span className="studio-kicker">A FEW GOOD QUESTIONS</span><h2>Know what<br/>comes next.</h2><Link href="/contact?service=support" className="studio-text-link">Talk to CQA ↗</Link></div><div>
      <details><summary>Can I try the design before paying?</summary><p>Yes. Use the free questionnaire and preview to see an illustrative storefront with your business details. A preview is not a published or payment-enabled machine.</p></details>
      <details><summary>Will the AI workers run my business automatically?</summary><p>The receptionist, sales and marketing workers prepare drafts using your business information. Customer replies, publishing and commitments remain under your review.</p></details>
      <details><summary>Can customers pay and receive downloads now?</summary><p>Live customer payments remain paused while payment, private delivery and account-isolation verification is completed. Explore the preview or register for assisted early access.</p></details>
      <details><summary>What if I want help with setup?</summary><p>Request premium setup or custom automation support. We will confirm the scope with you before implementation. The optional Pro Launch Package is listed on the pricing page.</p></details>
    </div></section>
    <section className="studio-wrap studio-final"><div><span className="studio-kicker">YOUR NEXT CHAPTER STARTS WITH A PREVIEW</span><h2>Make room for<br/><em>your big idea.</em></h2><p>Design first. Review the details. Take the next step with confidence.</p></div><div><Link href="/onboarding?plan=pro" className="studio-button">Create my free preview ↗</Link><Link href="/founding-customers" className="studio-text-link">Register for assisted early access →</Link></div></section>
  </main>;
}
