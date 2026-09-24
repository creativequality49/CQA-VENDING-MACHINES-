import Link from "next/link";
import { CQA_PLANS } from "@/lib/cqa-marketplace";

const workers = [
  ["Most Popular", "Content Engine Worker", "Create weeks of on-brand content from one idea.", "Creators, coaches, and personal brands", "15 min", "Create Content", "pink"],
  ["Fastest ROI", "Lead Capture Worker", "Turn website visitors into organized, qualified leads.", "Agencies, consultants, and service businesses", "20 min", "Get Leads", "cyan"],
  [null, "Sales Follow-Up Worker", "Respond, qualify, and follow up without letting warm leads go cold.", "Digital products and high-ticket offers", "20 min", "Sell Products", "gold"],
  ["Beginner Friendly", "Social Content Worker", "Turn your expertise into consistent posts for the platforms that matter.", "New creators and lean teams", "10 min", "Create Content", "violet"]
] as const;

export default function MarketplacePage() {
  const startingPrice = Math.min(...CQA_PLANS.map((plan) => plan.price));
  return <main className="container marketplace-page neon-marketplace-page" style={{ paddingTop: "2.5rem", paddingBottom: "4rem" }}><section className="marketplace-neon-hero"><div><span className="eyebrow">CQA AI WORKFORCE</span><h1>Choose Your AI Worker</h1><p>Deploy prebuilt AI systems for the work that creates momentum: content, leads, and sales.</p></div><div className="marketplace-live-panel"><span><i /> READY TO DEPLOY</span><strong>4</strong><small>starter workers</small></div></section><nav className="category-rail neon-category-rail" aria-label="Worker categories">{["All Workers", "Create Content", "Get Leads", "Sell Products", "Customer Support"].map((label, index) => <span className={`button ${index === 0 ? "primary" : "ghost"}`} key={label}>{label}</span>)}</nav><section className="worker-grid marketplace-worker-grid">{workers.map(([badge, title, description, bestFor, setup, filter, accent]) => <article className={`worker-card ${accent}`} key={title}>{badge ? <span className="worker-badge">{badge}</span> : null}<span className="worker-index">{filter}</span><h2>{title}</h2><p>{description}</p><dl><div><dt>Best for</dt><dd>{bestFor}</dd></div><div><dt>Setup time</dt><dd>{setup}</dd></div></dl><strong className="worker-price">From ${startingPrice}/month</strong><Link href="/onboarding" className="card-link">Deploy Worker →</Link></article>)}</section><section className="final-panel" style={{ marginTop: "2rem" }}><div><span className="eyebrow">NEED A STARTING POINT?</span><h2>Not sure where to start?</h2><p>Begin with the Growth Plan and deploy the Worker stack built for momentum.</p></div><Link href="/onboarding?plan=pro" className="button primary">Start With Growth Plan</Link></section></main>;
}
