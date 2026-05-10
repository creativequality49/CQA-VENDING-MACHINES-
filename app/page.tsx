import Link from "next/link";
import { PricingCard } from "@/components/PricingCard";
import { Section } from "@/components/Section";

export default function HomePage() {
  return (
    <main className="container page">
      <section className="glass-card hero">
        <span className="pill">Creative Quality Australia</span>
        <div className="hero-grid" style={{ marginTop: ".8rem" }}>
          <div>
            <h1>CQA Digital Vending Machines</h1>
            <p>Automated digital product storefronts selling 24/7 with premium funnels, vault access, and recurring content drops.</p>
            <div style={{ display: "flex", gap: ".7rem", flexWrap: "wrap", marginTop: "1rem" }}>
              <Link href="/machine/store" className="cta">Enter Store</Link>
              <Link href="/machine/scarlett-vault" className="cta secondary">View Scarlett Vault</Link>
            </div>
          </div>
          <div className="vending-visual">
            <div className="vending-slot"><span>Basic</span><span>$79</span></div>
            <div className="vending-slot"><span>Pro</span><span>$249</span></div>
            <div className="vending-slot"><span>Elite</span><span>$899</span></div>
            <div className="vending-slot"><span>Subscription</span><span>Monthly</span></div>
          </div>
        </div>
      </section>

      <Section title="Pricing Preview" subtitle="Choose your revenue acceleration tier.">
        <div className="grid grid-3">
          <PricingCard name="Basic" price="$79" bullets={["Launch funnel fast", "1 machine", "Core assets"]} cta={<Link href="/machine/store" className="cta">Start Basic</Link>} />
          <PricingCard name="Pro" price="$249" bullets={["Advanced automation", "Upsell assets", "Priority drops"]} cta={<Link href="/machine/store" className="cta">Upgrade Pro</Link>} />
          <PricingCard name="Elite" price="$899" bullets={["Premium licensing", "Private vault", "Concierge strategy"]} cta={<Link href="/machine/store" className="cta">Go Elite</Link>} />
        </div>
      </Section>
    </main>
  );
}
