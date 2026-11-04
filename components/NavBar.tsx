import Link from "next/link";
import { isNewCqaCheckoutAllowed } from "@/lib/cqa-launch-gate";

export function NavBar() {
  return (
    <>
      <div className="cqa-announcement">{isNewCqaCheckoutAllowed() ? "Turn your business into a digital vending machine — powered by an AI workforce." : <Link href="/founding-customers">Customer launch checks are in progress · Register founding-customer interest →</Link>}</div>
      <header className="site-header cqa-topbar">
        <div className="nav-shell cqa-nav-shell">
          <Link href="/" className="cqa-logo-lockup" aria-label="Creative Quality Australia home">
            <img
              src="/cqa-logo.svg"
              alt="Creative Quality Australia"
              className="cqa-logo-image"
            />
          </Link>

          <Link href="/owner/dashboard" className="cqa-dashboard-link">Dashboard</Link>

          <nav className="cqa-desktop-links" aria-label="Primary navigation">
            <Link href="/marketplace">Storefronts</Link>
            <Link href="/machines">Business solutions</Link>
            <Link href="/pricing">Machine plans</Link>
            <Link href="/workers">AI Workers</Link>
            <Link href="/automations">Automations</Link>
          </nav>

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
              <Link href="/marketplace">Storefronts <span>02</span></Link>
              <Link href="/machines">Business solutions <span>03</span></Link>
              <Link href="/pricing">Machine plans <span>04</span></Link>
              <Link href="/workers">AI Workers <span>05</span></Link>
              <Link href="/automations">Automations <span>06</span></Link>
              <Link href="/owner/dashboard">Dashboard <span>07</span></Link>
              <Link href="/contact">Contact CQA <span>08</span></Link>
              <div className="menu-panel-actions">
                <Link href="/login?next=/owner/dashboard" className="button ghost">Owner Login</Link>
                <Link href="/onboarding" className="button primary">Create storefront</Link>
              </div>
            </nav>
          </details>
        </div>
      </header>

      <nav className="mobile-dock" aria-label="Mobile navigation">
        <Link href="/marketplace"><b>⌂</b><span>Explore</span></Link>
        <Link href="/onboarding"><b>＋</b><span>Launch</span></Link>
        <Link href="/owner/dashboard"><b>▦</b><span>Workspace</span></Link>
        <Link href="/automations"><b>✦</b><span>Automate</span></Link>
      </nav>
    </>
  );
}
