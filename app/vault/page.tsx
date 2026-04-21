import Link from "next/link";
import { getAuthenticatedUser } from "@/lib/auth";
import { findProductById } from "@/lib/products";
import { getDownloadsForUser } from "@/lib/supabase-rest";

export default async function VaultPage() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return (
      <main className="container">
        <h1 className="title">Vault</h1>
        <p className="muted">You need an authenticated Supabase session to view vault assets.</p>
        <Link href="/" className="button button--ghost">
          Return Home
        </Link>
      </main>
    );
  }

  const downloads = await getDownloadsForUser(user.id);

  return (
    <main className="container">
      <h1 className="title">Vault Unlocks</h1>
      <p className="muted">Secure access links are tokenized and expire automatically.</p>

      <div className="grid" style={{ marginTop: "1rem" }}>
        {downloads.map((item) => {
          const product = findProductById(item.product_id);
          return (
            <article className="card" key={item.id}>
              <h2 style={{ marginTop: 0 }}>{product?.name ?? `Product #${item.product_id}`}</h2>
              <p className="muted">Expires: {new Date(item.expires_at).toLocaleString()}</p>
              <Link href={`/api/download/${item.download_token}`} className="button">
                Secure Download
              </Link>
            </article>
          );
        })}
      </div>
    </main>
  );
}
