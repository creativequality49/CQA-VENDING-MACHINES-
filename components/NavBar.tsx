import Link from "next/link";

export function NavBar() {
  return (
    <>
      <header className="site-header">
        <div className="nav-shell">
          <Link href="/" className="brand-lockup" aria-label="Creative Quality Australia home">
            <span className="brand-mark">CQA</span>
            <span>
              <strong>Creative Quality Australia</strong>
              <small>Vending Marketplace · AI Workforce</small>
            </span>
          </Link>

          <nav className="desktop-nav" aria-label="Primary navigation">
            <Link href="/marketplace">Marketplace</Link>
            <Link href="/pricing">Plans</Link>
            <Link href="/workers">AI Workers</Link>
            <Link href="/owner/dashboard">Owner Workspace</Link>
          </nav>

          <Link href="/onboarding" className="nav-cta">Launch My Machine</Link>
        </div>
      </header>

      <nav className="mobile-dock" aria-label="Mobile navigation">
        <Link href="/marketplace"><b>⌂</b><span>Explore</span></Link>
        <Link href="/onboarding"><b>＋</b><span>Launch</span></Link>
        <Link href="/owner/dashboard"><b>▦</b><span>Workspace</span></Link>
        <Link href="/workers"><b>✦</b><span>AI Workers</span></Link>
      </nav>
    </>
  );
}
