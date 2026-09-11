import Link from "next/link";

export function NavBar() {
  return (
    <header className="site-header">
      <div className="nav-shell">
        <Link href="/" className="brand-lockup" aria-label="Creative Quality Australia home">
          <span className="brand-mark">CQA</span>
          <span>
            <strong>Creative Quality Australia</strong>
            <small>Business Vending Marketplace</small>
          </span>
        </Link>

        <nav className="desktop-nav" aria-label="Primary navigation">
          <Link href="/marketplace">Marketplace</Link>
          <Link href="/pricing">Plans</Link>
          <Link href="/workers">AI Workers</Link>
          <Link href="/owner/dashboard">Owner Dashboard</Link>
        </nav>

        <Link href="/onboarding" className="nav-cta">Get My Machine</Link>
      </div>
    </header>
  );
}
