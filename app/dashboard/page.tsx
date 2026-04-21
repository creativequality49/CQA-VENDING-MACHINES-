import Link from "next/link";
import { getAuthenticatedUser } from "@/lib/auth";
import { findProductById } from "@/lib/products";
import { getDownloadsForUser } from "@/lib/supabase-rest";

export default async function DashboardPage() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return (
      <main className="container">
        <h1 className="title">Dashboard</h1>
        <p className="muted">No active Supabase session detected. Sign in and retry to load your vault.</p>
        <Link href="/" className="button button--ghost">
          Return Home
        </Link>
      </main>
    );
  }

  const downloads = await getDownloadsForUser(user.id);

  return (
    <main className="container">
      <h1 className="title">Welcome back</h1>
      <p className="muted">{user.email ?? "Authenticated user"}</p>

      <section style={{ marginTop: "1.5rem" }}>
        <h2 className="title">Purchased Assets</h2>
        {downloads.length === 0 ? (
          <p className="muted">No fulfilled purchases found yet.</p>
        ) : (
          <div className="grid">
            {downloads.map((item) => {
              const product = findProductById(item.product_id);
              return (
                <article className="card" key={item.id}>
                  <h3 style={{ marginTop: 0 }}>{product?.name ?? `Product #${item.product_id}`}</h3>
                  <p className="muted">Token expires: {new Date(item.expires_at).toLocaleString()}</p>
                  <Link href={`/api/download/${item.download_token}`} className="button">
                    Download File
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div style={{ marginTop: "1.5rem" }}>
        <Link href="/vault" className="button button--ghost">
          Open Vault
        </Link>
      </div>
    </main>
  );
}
