import Link from "next/link";

const navItems = [
  ["Home", "/"],
  ["Machines", "/machines"],
  ["Rent Machine", "/pricing"],
  ["Pricing", "/pricing"],
  ["Vault", "/vault"],
  ["Account", "/account"],
];

export function NavBar() {
  return (
    <header className="container" style={{ padding: "1rem 0" }}>
      <div className="glass-card" style={{ padding: "0.8rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <Link href="/" style={{ fontWeight: 800, color: "#ff7bd3" }}>CQA Vending OS</Link>
        <nav style={{ display: "flex", gap: "0.9rem", fontSize: "0.9rem", flexWrap: "wrap" }}>
          {navItems.map(([label, href]) => <Link key={label} href={href}>{label}</Link>)}
        </nav>
      </div>
    </header>
  );
}
