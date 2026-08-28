import Link from "next/link";
import { getFanXDb } from "@/lib/fanx-db";
import styles from "./home.module.css";

export const dynamic = "force-dynamic";

export default async function Home() {
  const db = getFanXDb();
  const { data: creators } = await db
    .from("fanx_creators")
    .select("id,slug,display_name,handle,bio,avatar_url,cover_url,verified")
    .eq("status", "active")
    .limit(8);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/fanxfantasy" aria-label="FanXFantasy home">
          <img className={styles.logo} src="/fanx/logo.png" alt="FanXFantasy" />
        </Link>
        <div className={styles.headerActions}>
          <Link className={styles.iconBtn} href="/fanxfantasy/explore" aria-label="Search creators">⌕</Link>
          <Link className={styles.iconBtn} href="/fanxfantasy/auth" aria-label="Account">◎</Link>
          <Link className={`${styles.secondary} ${styles.desktopText}`} href="/fanxfantasy/explore">Explore</Link>
          <Link className={`${styles.secondary} ${styles.desktopText}`} href="/fanxfantasy/marketplace">Marketplace</Link>
          <Link className={styles.join} href="/fanxfantasy/auth">Join free</Link>
        </div>
      </header>

      <div className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroImage} />
          <div className={styles.heroContent}>
            <span className={styles.eyebrow}>AI creators · premium worlds</span>
            <h1>AI creators.<br /><span>Real fantasies.</span></h1>
            <p>Discover creator worlds, follow for free, then unlock subscriptions, drops and private experiences.</p>
            <div className={styles.heroButtons}>
              <Link className={styles.primary} href="/fanxfantasy/explore">Explore creators</Link>
              <Link className={styles.secondary} href="/fanxfantasy/dashboard">Become a creator</Link>
            </div>
          </div>
        </section>

        <div className={styles.trustRow}>
          <div className={styles.trust}><b>18+ verified</b><span>Protected mature access</span></div>
          <div className={styles.trust}><b>Private & secure</b><span>Protected purchases</span></div>
          <div className={styles.trust}><b>Creator first</b><span>Built to earn & grow</span></div>
        </div>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div><span className={styles.eyebrow}>Trending now</span><h2>Featured creators</h2></div>
            <Link className={styles.viewAll} href="/fanxfantasy/explore">View all →</Link>
          </div>
          <div className={styles.creatorRail}>
            {(creators || []).map((creator) => (
              <Link className={styles.creatorCard} key={creator.id} href={`/fanxfantasy/creator/${creator.slug}`}>
                <div
                  className={styles.creatorImage}
                  style={{ backgroundImage: `url(${creator.avatar_url || creator.cover_url || "/fanx/mascot.png"})` }}
                />
                <div className={styles.creatorInfo}>
                  <div className={styles.creatorTop}>
                    <h3>{creator.display_name} {creator.verified ? <span className={styles.verified}>✓</span> : null}</h3>
                    <span className={styles.badge}>VIEW</span>
                  </div>
                  <div className={styles.handle}>{creator.handle}</div>
                  <p className={styles.bio}>{creator.bio}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div><span className={styles.eyebrow}>FanXFantasy</span><h2>Choose your experience</h2></div>
          </div>
          <div className={styles.featureGrid}>
            <Link className={styles.featureCard} href="/fanxfantasy/feed"><b>Premium feed</b><span>Follow creators and unlock drops</span></Link>
            <Link className={styles.featureCard} href="/fanxfantasy/messages"><b>Private chat</b><span>Creator messaging and locked content</span></Link>
            <Link className={styles.featureCard} href="/fanxfantasy/marketplace"><b>Marketplace</b><span>Bundles, images, videos and products</span></Link>
            <Link className={styles.featureCard} href="/fanxfantasy/dashboard"><b>Creator Studio</b><span>Build, automate and grow your creator business</span></Link>
          </div>
          <div className={styles.ageBar}><strong>18+</strong><span>Public previews stay non-explicit. Mature content and purchases require verified age assurance.</span></div>
        </section>
      </div>

      <nav className={styles.bottomNav} aria-label="Fan navigation">
        <Link href="/fanxfantasy"><b>⌂</b><span>Home</span></Link>
        <Link href="/fanxfantasy/explore"><b>⌕</b><span>Explore</span></Link>
        <Link href="/fanxfantasy/feed"><b>▣</b><span>Feed</span></Link>
        <Link href="/fanxfantasy/messages"><b>✉</b><span>Messages</span></Link>
        <Link href="/fanxfantasy/library"><b>▤</b><span>Library</span></Link>
      </nav>
    </main>
  );
}
