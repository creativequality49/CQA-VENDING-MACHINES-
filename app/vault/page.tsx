import { getCurrentUser } from "@/lib/auth";
import { getVaultSections } from "@/lib/content-service";

export const dynamic = "force-dynamic";

function ContentCard({ item }: { item: { id: string; title: string; description: string | null; accessType: string; unlocked: boolean } }) {
  return (
    <article className="glass-card" style={{ padding: "1rem" }}>
      <p className="small" style={{ textTransform: "uppercase" }}>{item.accessType}</p>
      <h3>{item.title}</h3>
      <p className="small">{item.description}</p>
      {item.unlocked ? <a className="cta" href={`/api/content/${item.id}/download`}>Secure Download</a> : <span className="locked-pill">Locked premium content</span>}
    </article>
  );
}

export default async function VaultPage() {
  const user = await getCurrentUser();
  const sections = await getVaultSections(user);
  const groups = [
    ["My Downloads", sections.myDownloads],
    ["New Drops", sections.newDrops],
    ["Purchased Bundles", sections.purchasedBundles],
    ["Subscription Vault", sections.subscriptionVault],
    ["Recently Added", sections.recentlyAdded],
    ["Locked Premium Content", sections.lockedPremium],
  ] as const;

  return (
    <main className="container" style={{ paddingBottom: "2rem" }}>
      <section className="glass-card hero"><h1 className="section-title glow">CQA Secure Vault</h1><p className="small">Downloads only appear after server-side entitlement checks pass.</p></section>
      {groups.map(([title, items]) => (
        <section key={title} style={{ marginBottom: "1rem" }}>
          <h2>{title}</h2>
          <div className="grid grid-3">
            {items.map((item) => "bundleTitle" in item ? <article key={item.id} className="glass-card" style={{ padding: "1rem" }}><h3>{item.bundleTitle}</h3><p className="small">Purchased bundle vault item.</p></article> : <ContentCard key={item.id} item={item} />)}
          </div>
          {items.length === 0 ? <p className="small">Nothing available in this section yet.</p> : null}
        </section>
      ))}
    </main>
  );
}
