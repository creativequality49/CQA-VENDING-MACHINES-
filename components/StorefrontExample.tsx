import Image from "next/image";
import Link from "next/link";

const examples = {
  beauty: { name: "Luna Beauty", category: "BEAUTY & WELLNESS", letter: "L", headline: "A little time. All for you.", description: "Treatments, memberships and a moment to reset.", slug: "demo-luna-beauty", offers: [["Signature treatment", "Request a booking", "watch"], ["VIP membership", "Explore the plan", "bag"]], tone: "pink" },
  creator: { name: "Your Creator Studio", category: "CREATORS & DIGITAL BRANDS", letter: "C", headline: "Your ideas. A place to grow.", description: "Bring your offers, content and enquiries together.", slug: "", offers: [["Digital collection", "Preview an offer", "camera"], ["Members space", "Explore membership", "headphones"]], tone: "aqua" },
  business: { name: "Summit Plumbing", category: "LOCAL BUSINESS", letter: "S", headline: "Good service starts here.", description: "A clear next step for every customer enquiry.", slug: "demo-summit-plumbing", offers: [["Hot water service", "Request a booking", "tablet"], ["Your next project", "Request a quote", "sneaker"]], tone: "aqua" }
} as const;

export default function StorefrontExample({ kind = "beauty" }: { kind?: keyof typeof examples }) {
  const example = examples[kind];
  return <div className={`studio-example studio-example-${example.tone}`}>
    <div className="studio-example-bar"><span aria-hidden="true">● ● ●</span><span>ILLUSTRATIVE STOREFRONT</span></div>
    <div className="studio-example-brand"><b>{example.letter}</b><span>{example.name}<small>Powered by CQA</small></span><span aria-hidden="true">→</span></div>
    <div className="studio-example-intro"><span className="studio-kicker">{example.category}</span><h3>{example.headline}</h3><p>{example.description}</p></div>
    <div className="studio-example-offers">{example.offers.map(([name, action, icon]) => <div key={name}><div className="studio-example-product"><Image src={`/images/slots/${icon}.svg`} alt="" width={64} height={64}/></div><strong>{name}</strong><span>{action} <span aria-hidden="true">→</span></span></div>)}</div>
    <Link className="studio-example-link" href={example.slug ? `/machine/${example.slug}` : "/onboarding?plan=starter"}>{example.slug ? "Open interactive demo" : "Create your own preview"} <span aria-hidden="true">→</span></Link>
  </div>;
}
