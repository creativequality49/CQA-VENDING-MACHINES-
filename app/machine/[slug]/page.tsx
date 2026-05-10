import { notFound } from "next/navigation";
import { CheckoutButton } from "@/components/CheckoutButton";
import { getMachine, tierDisplayOrder } from "@/lib/catalog";

export default async function MachinePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const machine = getMachine(slug);
  if (!machine) notFound();

  return (
    <main className="container" style={{ paddingBottom: "2rem" }}>
      <section className="glass-card" style={{ padding: "1rem", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0 }}>{machine.title}</h1>
        <p className="small">{machine.subtitle}</p>
      </section>

      <section className="grid grid-2" style={{ marginBottom: "1rem" }}>
        {machine.products.map((product) => (
          <article key={product.id} className="glass-card" style={{ padding: "1rem" }}>
            <p className="small" style={{ margin: 0, textTransform: "uppercase" }}>{product.tier}</p>
            <h3>{product.title}</h3>
            <p className="small">{product.description}</p>
            <p style={{ color: "#ff7bd3", fontWeight: 700 }}>{product.priceLabel}</p>
            <p className="small">State: {product.subscriberOnly ? "Locked (subscriber-only)" : "Unlocked after purchase"}</p>
            <CheckoutButton productId={product.id} tier={product.tier} machineSlug={machine.slug} label="Unlock Premium Access" />
          </article>
        ))}
      </section>

      <section className="glass-card" style={{ padding: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>Tier Ladder</h2>
        <div style={{ display: "grid", gap: "0.8rem" }}>
          {tierDisplayOrder.map((tier) => (
            <div key={tier} style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "0.8rem" }}>
              <strong style={{ textTransform: "uppercase" }}>{tier}</strong>
              <p className="small" style={{ marginBottom: 0 }}>Premium CTA: Elevate your access with the {tier} tier.</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
