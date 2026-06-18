import Link from "next/link";
import { getStoreProducts } from "@/lib/content-service";

export const dynamic = "force-dynamic";

export default async function ScarlettPage() {
  const products = await getStoreProducts("scarlett-vault");
  return (
    <main className="container" style={{ paddingBottom: "2rem" }}>
      <section className="glass-card hero">
        <p className="small">scarlettmay.online funnel</p>
        <h1 className="section-title glow">Enter the Scarlett May Digital Vault</h1>
        <p className="small">Luxury AI influencer funnel powered by live Supabase product records.</p>
        <Link className="cta" href="/machine/scarlett-vault">Open Scarlett Vault</Link>
      </section>
      <section className="grid grid-3" style={{ marginBottom: "1rem" }}>
        {products.map((product) => (
          <article key={product.id} className="glass-card" style={{ padding: "1rem" }}>
            <h3>{product.title}</h3><p style={{ color: "#ff7bd3", fontWeight: 700 }}>${product.priceAud} AUD</p>
            <p className="small">{product.description}</p>
          </article>
        ))}
      </section>
      {products.length === 0 ? <p className="small">Scarlett vault products are being prepared for launch.</p> : null}
    </main>
  );
}
