import { CheckoutButton } from "@/components/CheckoutButton";
import { getCurrentUser, isAdminRole } from "@/lib/auth";
import { getStoreProducts } from "@/lib/content-service";

export const dynamic = "force-dynamic";

export default async function StorePage() {
  const [products, user] = await Promise.all([getStoreProducts(), getCurrentUser()]);
  const isAdmin = isAdminRole(user?.role);

  return (
    <main className="container" style={{ paddingBottom: "2rem" }}>
      <section className="glass-card hero">
        <p className="small">Creative Quality Australia</p>
        <h1 className="section-title glow">CQA Digital Vending Store</h1>
        <p className="small">Real products are loaded from Supabase/Postgres. No mock checkout or demo downloads.</p>
      </section>
      <section className="grid grid-2">
        {products.map((product) => (
          <article key={product.id} className="glass-card" style={{ padding: "1rem" }}>
            <p className="small" style={{ textTransform: "uppercase" }}>{product.tier} • {product.status}</p>
            <h2>{product.title}</h2>
            <p className="small">{product.description}</p>
            <p style={{ color: "#ffcc33", fontWeight: 800 }}>${product.priceAud} AUD</p>
            <p className="small">Machine: {product.machine?.name ?? "Unassigned"}</p>
            {product.stripePriceId ? (
              <CheckoutButton productId={product.id} tier={product.tier} machineSlug={product.machine?.slug ?? "store"} label="Start Stripe Checkout" />
            ) : isAdmin ? (
              <p className="small warning">Admin setup required: add stripe_price_id before this product can sell.</p>
            ) : null}
          </article>
        ))}
      </section>
      {products.length === 0 ? <p className="small">Products are being prepared for launch.</p> : null}
    </main>
  );
}
