import Link from "next/link";
import { isNewCqaCheckoutAllowed } from "@/lib/cqa-launch-gate";
import { ThemeToggle } from "./ThemeToggle";
import { NavigationMenu } from "./NavigationMenu";
import styles from "./NavBar.module.css";

const links: Array<[string,string]> = [
  ["Home", "/"], ["Marketplace", "/marketplace"], ["Collection", "/machines"], ["Build your machine", "/onboarding"],
  ["Pricing", "/pricing"], ["My purchases", "/account"], ["Support", "/contact?service=support"],
];
export function NavBar() {
  return <>
    <div className={styles.announcement}>{isNewCqaCheckoutAllowed() ? "Creative Quality Australia · A home for your business ideas." : <Link href="/founding-customers">Customer launch checks are in progress · Register for early access →</Link>}</div>
    <header className={styles.header}><div className={styles.shell}>
      <Link href="/" className={styles.brand} aria-label="Creative Quality Australia home"><span className={styles.brandMark}>CQ<span>A</span></span><small>CREATIVE QUALITY<br />AUSTRALIA</small></Link>
      <nav className={styles.desktop} aria-label="Primary navigation">{links.map(([label,href])=><Link key={href} href={href}>{label}</Link>)}</nav>
      <Link href="/login?next=/owner/dashboard" className={styles.workspace}>Your workspace →</Link>
      <ThemeToggle />
      <NavigationMenu links={links} />
    </div></header>
  </>;
}
