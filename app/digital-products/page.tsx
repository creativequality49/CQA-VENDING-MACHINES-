import Link from "next/link";
import { machines } from "@/lib/catalog";
import "./digital-products.css";

export const metadata = { title: "Digital Kits | CQA", description: "Explore CQA digital kit proposals, listed prices and intended contents. Confirm availability with CQA." };

export default function DigitalProductsPage() {
  const products = machines.flatMap((machine) => machine.products);
  return <main className="container cqa-digital-products">
    <header className="cqa-digital-hero"><span className="eyebrow">CQA DIGITAL SOLUTIONS</span><h1>Explore your next<br/><em>digital toolkit.</em></h1><p>Browse the listed kits, prices and intended contents. Availability, final deliverables and private delivery must be confirmed with CQA before purchase.</p><div className="cqa-digital-hero-actions"><Link href="/onboarding" className="button ghost">Build your own machine</Link><Link href="/contact?service=support" className="button ghost">Ask a question</Link></div></header>
    <section aria-labelledby="products-heading"><div className="cqa-digital-section-head"><h2 id="products-heading">Digital kit catalogue</h2><p>Listed contents and prices are a preview. Confirm availability and delivery with CQA before purchasing. This page accepts enquiries only.</p></div><div className="cqa-digital-grid">{products.map((product) => {
      return <article className="cqa-digital-card" key={product.id}><div className="cqa-digital-card-head"><span className="cqa-digital-category">{product.tier.toUpperCase()} DIGITAL KIT</span><span className="cqa-digital-status">Preparing for launch</span></div><h3>{product.title}</h3><p>{product.description}</p><h4>Intended contents</h4><ul>{product.deliverables.map((item) => <li key={item}>{item}</li>)}</ul><div className="cqa-digital-bottom"><strong>{product.priceLabel}</strong><span>Listed price · confirm availability and scope before paying</span></div><Link className="cqa-digital-link" href={`/contact?service=digital-kit&product=${encodeURIComponent(product.id)}`}>Enquire about this kit</Link></article>;
    })}</div></section>
    <section className="cqa-digital-owner"><h2>Want to sell your own digital products?</h2><p>Preview a branded storefront for your business. Paid digital delivery remains subject to launch verification.</p><Link className="button primary" href="/onboarding">Build My Machine</Link></section>
  </main>;
}
