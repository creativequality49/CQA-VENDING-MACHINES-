import Link from "next/link";
import { PricingCard } from "@/components/PricingCard";

export default function HomePage() {
  return (
    <main className="container" style={{ paddingBottom: "2rem" }}>
      <section className="glass-card" style={{ padding: "1.2rem", marginBottom: "1rem" }}>
        <p className="small">Luxury digital vending machine ecosystem</p>
        <h1 className="section-title">CQA Digital Vending Machines</h1>
        <p className="small" style={{ maxWidth: 700 }}>
          Automated digital product storefronts selling 24/7.
        </p>
        <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap", marginTop: "1rem" }}>
          <Link href="/machine/store" className="cta">Enter Store</Link>
          <Link href="/machine/scarlett-vault" className="cta secondary">View Scarlett Vault</Link>
        </div>
      </section>

      <section className="grid grid-3" style={{ marginBottom: "1rem" }}>
        <PricingCard name="Basic" price="$79" bullets={["Launch funnel fast", "1 machine", "Core assets"]} cta={<Link href="/machine/store" className="cta">Start Basic</Link>} />
        <PricingCard name="Pro" price="$249" bullets={["Advanced automation", "Upsell assets", "Priority drops"]} cta={<Link href="/machine/store" className="cta">Upgrade Pro</Link>} />
        <PricingCard name="Elite" price="$899" bullets={["Premium licensing", "Private vault", "Concierge strategy"]} cta={<Link href="/machine/store" className="cta">Go Elite</Link>} />
      </section>

      <section className="glass-card" style={{ padding: "1.2rem" }}>
        <h2 style={{ marginTop: 0 }}>Neon Machine Interface</h2>
        <div className="grid grid-2">
          <div style={{ minHeight: 180, borderRadius: 14, border: "1px solid rgba(255,47,179,0.45)", boxShadow: "inset 0 0 32px rgba(255,47,179,0.28)", display: "grid", placeItems: "center" }}>
            <p style={{ fontWeight: 700 }}>CQA Vending Core</p>
          </div>
          <div className="small">
            <p>Phone-first storefront UX.</p>
            <p>Secure checkout, recurring drops, and entitlements.</p>
            <p>Production-grade route layout for Vercel multi-domain deployment.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
