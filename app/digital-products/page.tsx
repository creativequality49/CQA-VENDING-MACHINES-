import Link from "next/link";
import { machines, getProductReadiness } from "@/lib/catalog";
import "./digital-products.css";

export const metadata = { title: "Digital Product Marketplace | CQA", description: "Preview CQA digital kits and their included files before purchasing." };

export default function DigitalProductsPage() {
  const products = machines.flatMap(machine => machine.products);
  return <main className="container cqa-digital-products">
    <header className="cqa-digital-hero"><span className="eyebrow">CQA DIGITAL SOLUTIONS</span><h1>Choose your solution.<br/><em>Put it to work.</em></h1><p>Explore practical digital toolkits, creator resources and business systems. Each product shows what is included and whether secure delivery is ready.</p><div className="cqa-digital-hero-actions"><Link href="/machines" className="button ghost">Rent your own machine</Link><Link href="/contact?service=support" className="button ghost">Ask a question</Link></div></header>
    <section aria-labelledby="products-heading"><div className="cqa-digital-section-head"><h2 id="products-heading">Digital product catalogue</h2><p>Products are available to purchase only after files, payment and private delivery pass verification.</p></div><div className="cqa-digital-grid">{products.map(product => {const readiness = getProductReadiness(product);return <article className="cqa-digital-card" key={product.id}><div className="cqa-digital-card-head"><span className="cqa-digital-category">{product.tier.toUpperCase()} DIGITAL KIT</span><span className="cqa-digital-status">{readiness.sellable ? "Ready for purchase" : "Preparing for launch"}</span></div><h3>{product.title}</h3><p>{product.description}</p><h4>What you receive</h4><ul>{product.deliverables.map(item => <li key={item}>{item}</li>)}</ul><div className="cqa-digital-bottom"><strong>{product.priceLabel}</strong><span>{readiness.sellable ? "Delivery verified" : "Checkout unavailable until delivery is verified"}</span></div><Link className="cqa-digital-link" href={readiness.sellable ? `/machine/store?product=${encodeURIComponent(product.id)}` : "/contact?service=support"}>{readiness.sellable ? "View purchase options" : "Enquire about this kit"}</Link></article>})}</div></section>
    <section className="cqa-digital-owner"><h2>Want to sell your own digital products?</h2><p>Build a branded vending machine with your products, services and subscriptions.</p><Link className="button primary" href="/onboarding">Build My Machine</Link></section>
  </main>;
}
