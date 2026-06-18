import { notFound } from "next/navigation";
import { CheckoutButton } from "@/components/CheckoutButton";
import { getMachineWithProducts } from "@/lib/content-service";

export const dynamic = "force-dynamic";

export default async function MachinePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const machine = await getMachineWithProducts(slug);
  if (!machine) notFound();

  return (
    <main className="container" style={{ paddingBottom: "2rem" }}>
      <section className="glass-card hero">
        <h1 style={{ margin: 0 }}>{machine.name}</h1>
        <p className="small">{machine.description}</p>
      </section>
      <section className="grid grid-2" style={{ marginBottom: "1rem" }}>
        {machine.products.map((product) => (
          <article key={product.id} className="glass-card" style={{ padding: "1rem" }}>
            <p className="small" style={{ margin: 0, textTransform: "uppercase" }}>{product.tier} • {product.status}</p>
            <h3>{product.title}</h3>
            <p className="small">{product.description}</p>
            <p style={{ color: "#ff7bd3", fontWeight: 700 }}>${product.priceAud} AUD</p>
            {product.stripePriceId ? <CheckoutButton productId={product.id} tier={product.tier} machineSlug={machine.slug} label="Unlock Premium Access" /> : null}
          </article>
        ))}
      </section>
    </main>
  );
}
