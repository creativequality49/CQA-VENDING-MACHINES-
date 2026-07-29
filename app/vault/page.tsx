import Link from "next/link";
import { getDrops } from "@/lib/drops";
import { getUserVaultSnapshot } from "@/lib/mock-store";
import { machines } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function VaultPage() {
  const userId = "demo-user";
  const snapshot = getUserVaultSnapshot(userId);
  const drops = await getDrops();

  return (
    <main className="container" style={{ paddingBottom: "2rem" }}>
      <h1 className="section-title">Customer Vault</h1>
      <p className="small">Purchases, subscriptions, secure downloads and scheduled member drops.</p>

      <section className="grid grid-2" style={{ marginBottom: "1rem" }}>
        <article className="glass-card" style={{ padding: "1rem" }}>
          <h2 style={{ marginTop: 0 }}>Purchases</h2>
          {snapshot.orders.length === 0 ? <p className="small">No purchases yet.</p> : snapshot.orders.map((order) => <p key={order.id}>{order.productId}</p>)}
        </article>
        <article className="glass-card" style={{ padding: "1rem" }}>
          <h2 style={{ marginTop: 0 }}>Active Subscription</h2>
          <p className="small">{snapshot.subscription?.active ? `Active (${snapshot.subscription.tier})` : "Inactive"}</p>
        </article>
      </section>

      <section className="glass-card" style={{ padding: "1rem", marginBottom: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>Downloads</h2>
        {machines.flatMap((m) => m.products).map((product) => (
          <div key={product.id} style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", padding: "0.4rem 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <span>{product.title}</span>
            <a className="cta secondary" href={`/api/signed-download?productId=${product.id}&userId=${userId}`}>Secure Download</a>
          </div>
        ))}
      </section>

      <section className="grid grid-2">
        <article className="glass-card" style={{ padding: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>Scheduled Drops</h3>
          {drops.length === 0 ? (
            <p className="small">No content drops are scheduled.</p>
          ) : (
            drops.map((drop) => (
              <p className="small" key={drop.id}>{drop.title} — {drop.released ? "Released" : "Scheduled"}</p>
            ))
          )}
        </article>
        <article className="glass-card" style={{ padding: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>Elite Upsell</h3>
          <p className="small">Unlock all premium content, private support assets, and top-tier recurring drops.</p>
          <Link className="cta" href="/machine/store">Upgrade to Elite</Link>
        </article>
      </section>
    </main>
  );
}
