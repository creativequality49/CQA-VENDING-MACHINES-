import Link from "next/link";
import { Section } from "@/components/Section";

export default function ScarlettPage() {
  return (
    <main className="container page">
      <section className="glass-card hero">
        <span className="pill">scarlettmay.online</span>
        <h1>Enter the Scarlett May Digital Vault</h1>
        <p>Luxury AI influencer funnel with premium digital products, social-proof conversion blocks, and subscription upsells.</p>
        <div style={{ marginTop: "1rem" }}>
          <Link className="cta" href="/machine/scarlett-vault">Open Scarlett Vault</Link>
        </div>
      </section>

      <Section title="Premium Offers" subtitle="Designed for mobile-first conversion.">
        <div className="grid grid-3">
          {[ ["Starter Aesthetic Pack", "$97"], ["Pro Monetization Formula", "$297"], ["Elite Private Creator Access", "$997"] ].map(([name, price]) => (
            <article key={name} className="glass-card section-wrap" style={{ marginBottom: 0 }}>
              <h3 style={{ marginTop: 0 }}>{name}</h3>
              <p style={{ color: "#ff7bd3", fontWeight: 700 }}>{price}</p>
              <p className="small">Conversion-tuned copy, premium positioning, and scarcity CTA stacking.</p>
            </article>
          ))}
        </div>
      </Section>
    </main>
  );
}
