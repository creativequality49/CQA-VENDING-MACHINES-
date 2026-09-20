import Link from "next/link";

export function NavBar() {
  return (
    <>
      <header className="site-header cqa-topbar">
        <div className="nav-shell cqa-nav-shell">
          <Link href="/" className="cqa-logo-lockup" aria-label="Creative Quality Australia home">
            <span className="cqa-logo-mark" aria-hidden="true"><b>CQ</b><i>Λ</i></span>
            <span className="cqa-logo-copy">
              <strong>CREATIVE QUALITY</strong>
              <small>AUSTRALIA</small>
            </span>
          </Link>

          <details className="cqa-menu">
            <summary className="cqa-menu-trigger" aria-label="Open navigation menu">
              <span className="cqa-hamburger" aria-hidden="true"><i /><i /><i /></span>
              <b>MENU</b>
            </summary>
            <nav className="cqa-menu-panel" aria-label="Primary navigation">
              <div className="menu-panel-head">
                <span className="eyebrow">CQA NAVIGATION</span>
                <small>Vending Marketplace · AI Workforce</small>
              </div>
              <Link href="/">Home <span>01</span></Link>
              <Link href="/marketplace">Marketplace <span>02</span></Link>
              <Link href="/machines">Solutions <span>03</span></Link>
              <Link href="/pricing">Plans <span>04</span></Link>
              <Link href="/workers">AI Workers <span>05</span></Link>
              <Link href="/owner/dashboard">Owner Workspace <span>06</span></Link>
              <Link href="/contact">Contact CQA <span>07</span></Link>
              <div className="menu-panel-actions">
                <Link href="/login?next=/owner/dashboard" className="button ghost">Owner Login</Link>
                <Link href="/onboarding" className="button primary">Launch My Machine</Link>
              </div>
            </nav>
          </details>
        </div>
      </header>

      <nav className="mobile-dock" aria-label="Mobile navigation">
        <Link href="/marketplace"><b>⌂</b><span>Explore</span></Link>
        <Link href="/onboarding"><b>＋</b><span>Launch</span></Link>
        <Link href="/owner/dashboard"><b>▦</b><span>Workspace</span></Link>
        <Link href="/workers"><b>✦</b><span>Workers</span></Link>
      </nav>
    </>
  );
}
