import Link from "next/link";
import { CQA_PLANS } from "@/lib/cqa-marketplace";
import "./machine-store.css";

const featured = [
  { name: "Business Storefront", tag: "FOR BUSINESS", description: "Your complete digital vending machine. Present products, services and subscriptions in one branded storefront.", plan: "pro" as const, bullets: ["Branded machine preview", "Products, services and bookings", "Stripe connection after activation"] },
  { name: "Creator Storefront", tag: "FOR CREATORS", description: "Sell digital offers, memberships and services from a storefront designed around your brand.", plan: "starter" as const, bullets: ["Custom branding", "Guided product setup", "Private owner workspace"] },
  { name: "Enterprise Machine", tag: "ADVANCED SETUP", description: "Expanded capacity and hands-on setup for businesses with more complex operations.", plan: "elite" as const, bullets: ["Expanded selling capacity", "Integration planning", "Priority setup review"] }
];

export default function MachinesPage() {
  return <main className="container cqa-store">
    <header className="cqa-store-heading">
      <span className="eyebrow">CQA MACHINE STORE</span>
      <h1>Find your digital vending machine.</h1>
      <p>Choose a machine, personalise a free preview, then decide whether to subscribe. No payment is needed to preview.</p>
    </header>
    <nav className="cqa-store-tabs" aria-label="Explore CQA solutions">
      <Link href="/machines" aria-current="page">All Machines</Link>
      <Link href="/pricing">For Creators</Link>
      <Link href="/pricing">For Business</Link>
      <Link href="/workers">AI Powered</Link>
    </nav>
    <section className="cqa-store-list" aria-label="Digital vending machine plans">
      {featured.map((item, index) => {
        const plan = CQA_PLANS.find(p => p.key === item.plan)!;
        return <article className="cqa-store-card" key={item.plan}>
          <div className="cqa-store-card-copy">
            <span className="cqa-store-tag">{item.tag}</span>
            <h2>{item.name}</h2>
            <p>{item.description}</p>
            <ul>{item.bullets.map(b => <li key={b}>{b}</li>)}</ul>
            <p className="cqa-store-price">From <strong>${plan.price}</strong><span> AUD/month</span></p>
            <div className="cqa-store-actions">
              <Link href="/pricing" className="cqa-store-outline">View details</Link>
              <Link href={`/onboarding?plan=${plan.key}`} className="cqa-store-primary">Get started</Link>
            </div>
          </div>
          <div className="cqa-store-machine" aria-hidden="true"><div className="cqa-store-machine-top">CQA <span>0{index+1}</span></div><div className="cqa-store-machine-window">{Array.from({length:6},(_,i)=><span key={i}><i /></span>)}</div><div className="cqa-store-machine-foot"><span>EXPLORE</span><b>▣</b></div></div>
        </article>;
      })}
    </section>
    <section className="cqa-store-help"><h2>Want CQA to set it up for you?</h2><p>Request premium implementation or custom automation support separately from the self-service builder.</p><Link href="/contact?service=premium-setup" className="cqa-store-outline">Request premium setup</Link></section>
  </main>;
}
