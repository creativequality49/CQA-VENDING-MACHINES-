import Link from "next/link";
import { getPublicSupabaseClient, DEMO_MACHINES } from "@/lib/cqa-marketplace";
import styles from "./marketplace.module.css";

export const dynamic = "force-dynamic";
type Machine = { id: string; slug: string; title: string; subtitle: string | null; business: { name: string; category: string; description: string | null; location_text: string | null }; offers: { id: string; name: string; image_url: string | null; offer_type: string; price_cents: number | null; currency: string; active?: boolean }[] };

export default async function MarketplacePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 120) : "";
  let machines: Machine[] = [];
  let unavailable = false;
  try {
    const { data, error } = await getPublicSupabaseClient().from("cqa_machines")
      .select("id,slug,title,subtitle,business:cqa_businesses!inner(name,category,description,location_text),offers:cqa_offers(id,name,image_url,offer_type,price_cents,currency,active)")
      .eq("status", "live").eq("business.status", "live").order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    machines = ((data || []) as unknown as Machine[]).map(machine => ({ ...machine, offers: machine.offers.filter(offer => offer.active === true) }));
  } catch { unavailable = true; }
  const filtered = machines.filter(machine => !query || [machine.title, machine.business.name, machine.business.category, ...machine.offers.map(offer => offer.name)].join(" ").toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <main className={styles.page}>
    <header className={styles.hero}><span className={styles.kicker}>CQA / MERCHANT MARKETPLACE</span><h1>Real businesses.<br />Their own machines.</h1><p>Explore published merchant storefronts. Each business sets its products, delivery details and customer support terms.</p><Link className={styles.button} href="/owner/products">Manage my products →</Link></header>
    <section aria-label="Published merchant machines"><form className={styles.search} action="/marketplace"><label htmlFor="marketplace-search">Find a business, product or industry</label><div><input id="marketplace-search" name="q" defaultValue={query} maxLength={120} placeholder="Search machines and products" /><button className={styles.button}>Search</button></div></form>
      {unavailable ? <div className={styles.empty} role="status"><h2>We couldn’t load the marketplace.</h2><p>Please try again shortly. Example machines below are demonstrations, not purchasable stock.</p><Link href="/marketplace">Try again →</Link></div> : filtered.length === 0 ? <div className={styles.empty}><h2>{query ? "No matching machines yet." : "The first merchant machines are being prepared."}</h2><p>{query ? "Try another business or product name." : "Published stores will appear here. We keep examples separate from live merchant offers."}</p><Link href={query ? "/marketplace" : "/onboarding"}>{query ? "Clear search →" : "Start your machine →"}</Link></div> : <div className={styles.grid}>{filtered.map(machine => <article key={machine.id} className={styles.card}><span className={styles.kicker}>{machine.business.category}</span><h2>{machine.business.name}</h2><p>{machine.subtitle || machine.business.description}</p><div className={styles.products}>{machine.offers.slice(0,4).map(offer => <div key={offer.id}>{offer.image_url ? <div role="img" aria-label={offer.name} className={styles.productImage} style={{backgroundImage:`url(${JSON.stringify(offer.image_url)})`}} /> : <span className={styles.placeholder} aria-hidden="true">◇</span>}<strong>{offer.name}</strong><small>{offer.price_cents === null ? "Enquire for pricing" : new Intl.NumberFormat("en-AU", {style:"currency", currency:offer.currency.toUpperCase()}).format(offer.price_cents / 100)}</small></div>)}</div><p className={styles.meta}>{machine.offers.length} active offers · {machine.business.location_text || "Online"}</p><Link className={styles.button} href={`/machine/${encodeURIComponent(machine.slug)}`}>Enter machine →</Link></article>)}</div>}
    </section>
    <section className={styles.examples}><span className={styles.kicker}>EXPLORE THE EXPERIENCE</span><h2>Example machines</h2><p>Design demonstrations only. These businesses and offers do not accept payment.</p><div className={styles.exampleLinks}>{DEMO_MACHINES.map(machine => <Link key={machine.id} href={`/machine/${machine.slug}`}>{machine.business.name}<span>Demo →</span></Link>)}</div></section>
  </main>;
}
