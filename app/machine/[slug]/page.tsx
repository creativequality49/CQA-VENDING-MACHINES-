import { notFound } from "next/navigation";
import { CheckoutButton } from "@/components/CheckoutButton";
import { getMachine, getProductReadiness } from "@/lib/catalog";

const statusLabel = {
  draft: "In production",
  quality_review: "Quality review",
  live: "Available now"
} as const;

export default async function MachinePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const machine = getMachine(slug);
  if (!machine) notFound();

  return (
    <main className="container" style={{ paddingBottom: "3rem" }}>
      <section className="glass-card" style={{ padding: "1.4rem", marginBottom: "1rem" }}>
        <p className="small" style={{ textTransform: "uppercase", letterSpacing: ".14em" }}>CQA verified product vault</p>
        <h1 style={{ margin: 0 }}>{machine.title}</h1>
        <p className="small" style={{ maxWidth: 760 }}>{machine.subtitle}</p>
      </section>

      <section className="grid grid-2">
        {machine.products.map((product) => {
          const readiness = getProductReadiness(product);
          return (
            <article key={product.id} className="glass-card" style={{ padding: "1.2rem", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
                <p className="small" style={{ margin: 0, textTransform: "uppercase" }}>{product.tier}</p>
                <span className="small" style={{ color: readiness.sellable ? "#85ffc7" : "#ffb6df" }}>
                  {statusLabel[product.status]}
                </span>
              </div>
              <h2 style={{ marginBottom: ".35rem" }}>{product.title}</h2>
              <p className="small">{product.description}</p>
              <p style={{ color: "#ff7bd3", fontWeight: 800, fontSize: "1.2rem" }}>{product.priceLabel}</p>

              <h3 style={{ fontSize: "1rem" }}>Included</h3>
              <ul className="small" style={{ paddingLeft: "1.15rem", lineHeight: 1.7 }}>
                {product.deliverables.map((item) => <li key={item}>{item}</li>)}
              </ul>

              {product.disclaimer ? <p className="small" style={{ borderTop: "1px solid rgba(255,255,255,.1)", paddingTop: ".8rem" }}>{product.disclaimer}</p> : null}
              <p className="small"><strong>Licence:</strong> {product.licence}</p>
              <p className="small"><strong>Access:</strong> {product.accessPolicy}</p>

              <div style={{ marginTop: "auto", paddingTop: ".8rem" }}>
                {readiness.sellable ? (
                  <CheckoutButton productId={product.id} tier={product.tier} machineSlug={machine.slug} label="Buy securely with Stripe" />
                ) : (
                  <div style={{ border: "1px solid rgba(255,123,211,.35)", borderRadius: 12, padding: ".8rem", color: "#ffb6df", fontWeight: 700 }}>
                    Purchase disabled until the final product file, Stripe price and fulfilment test are verified.
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
