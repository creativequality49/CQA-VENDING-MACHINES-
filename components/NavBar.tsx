import Link from "next/link";

export function NavBar() {
  return (
    <header className="site-header">
      <div className="nav-shell">
        <Link href="/" className="brand-lockup" aria-label="Creative Quality Australia home">
          <span className="brand-mark">CQA</span>
          <span>
            <strong>Creative Quality Australia</strong>
            <small>Digital Vending Machines</small>
          </span>
        </Link>

        <nav className="desktop-nav" aria-label="Primary navigation">
          <Link href="/machines">Marketplace</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/launch-machine">Launch a Machine</Link>
          <Link href="/dashboard">Dashboard</Link>
        </nav>

        <Link href="/launch-machine" className="nav-cta">Rent a Machine</Link>
      </div>
    </header>
  );
}
