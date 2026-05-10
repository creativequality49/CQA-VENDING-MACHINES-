import Link from "next/link";

export function NavBar() {
  return (
    <header className="container" style={{ padding: "1rem 0" }}>
      <div className="glass-card" style={{ padding: "0.8rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href="/" style={{ fontWeight: 800, color: "#ff7bd3" }}>Creative Quality Australia</Link>
        <nav style={{ display: "flex", gap: "0.9rem", fontSize: "0.9rem" }}>
          <Link href="/machine/store">Store</Link>
          <Link href="/vault">Vault</Link>
          <Link href="/scarlett">Scarlett</Link>
          <Link href="/admin">Admin</Link>
        </nav>
      </div>
    </header>
  );
}
