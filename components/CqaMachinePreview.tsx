import type { CSSProperties } from "react";
import styles from "./CqaMachinePreview.module.css";

export type PreviewOffer = { name: string; price: string };

function DemoWatermark() {
  return <div className={styles.watermark} aria-hidden="true">{Array.from({ length: 8 }, (_, index) => <span key={index}>CQA · DEMO PREVIEW</span>)}</div>;
}

export default function CqaMachinePreview({ name, category, description, location, offers, colour }: {
  name: string; category: string; description: string; location: string; offers: PreviewOffer[]; colour: string;
}) {
  const businessName = name.trim() || "Your business name";
  const visibleOffers = offers.filter((offer) => offer.name.trim());
  const examples = visibleOffers.length ? visibleOffers : [{ name: "Your first service or product", price: "" }, { name: "Another way to work with you", price: "" }];
  return <section className={styles.preview} style={{ "--preview-accent": colour } as CSSProperties} aria-label="Your personalised machine template preview">
    <div className={styles.browser}><span>● ● ●</span><strong>CQA · DEMO PREVIEW</strong><span>↗</span></div>
    <div className={styles.body}>
      <header className={styles.header}><div className={styles.logo}>{businessName.slice(0, 1).toUpperCase()}</div><strong>{businessName}</strong><span className={styles.category}>{category}</span></header>
      <div className={styles.hero}>
        <DemoWatermark />
        <span className={styles.kicker}>{location.trim() || "Your service area"}</span>
        <h2>{name.trim() ? `Discover ${businessName}.` : "Your business. Ready to explore."}</h2>
        <p>{description.trim() || "Your business description appears here. Tell customers what you offer and why they should choose you."}</p>
        <span className={styles.demoButton}>Explore our offers ↓</span>
      </div>
      <div className={styles.sectionHeading}><h3>Ways to work with us</h3><span>{visibleOffers.length ? "Your draft offers" : "Example placement"}</span></div>
      <div className={styles.offers}><DemoWatermark />{examples.map((offer, index) => <article className={styles.offer} key={index}>
        <div className={styles.offerArtwork}><span>{String(index + 1).padStart(2, "0")}</span><span>✦</span></div>
        <h4>{offer.name}</h4>
        <p>{visibleOffers.length ? "Add the full offer details in your workspace." : "Replace this example with your own offer."}</p>
        <div className={styles.offerFooter}><strong>{offer.price.trim() && Number.isFinite(Number(offer.price)) && Number(offer.price) >= 0 ? new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(Number(offer.price)) : "Price to be confirmed"}</strong><span>View details ↗</span></div>
      </article>)}</div>
      <div className={styles.enquiry}><div><strong>Have a question?</strong><p>Customers can send an enquiry from your machine.</p></div><span className={styles.demoButton}>Enquire</span></div>
      <footer className={styles.footer}>Powered by CQA <span>Example design only · buttons do not take payments</span></footer>
      <aside className={styles.valueNotice} aria-label="What a paid CQA plan provides">
        <strong>The preview shows the design. Your plan runs the machine.</strong>
        <p>A paid plan provides your hosted machine, private owner workspace, payment connection tools and ongoing operation. This visual example does not include a working storefront export.</p>
        <p>Starter uses manual guided setup. AI-assisted builds and other features depend on your selected plan; review its inclusions before paying.</p>
      </aside>
    </div>
  </section>;
}
