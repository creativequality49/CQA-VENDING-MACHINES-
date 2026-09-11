import Link from "next/link";
import { DEMO_MACHINES, getPublicSupabaseClient, type MarketplaceMachine } from "@/lib/cqa-marketplace";

async function getLiveMachines(): Promise<MarketplaceMachine[]> {
  try {
    const supabase = getPublicSupabaseClient();
    const { data, error } = await supabase
      .from("cqa_machines")
      .select("id,slug,title,subtitle,theme,assistant_enabled,business:cqa_businesses!inner(id,name,slug,category,description,location_text,logo_url,plan,featured,verified),offers:cqa_offers(id,name,description,offer_type,price_cents,currency,stripe_price_id)")
      .eq("status", "live")
      .order("published_at", { ascending: false });

    if (error || !data) return [];
    return data as unknown as MarketplaceMachine[];
  } catch {
    return [];
  }
}

export default async function MarketplacePage() {
  const liveMachines = await getLiveMachines();
  const machines = liveMachines.length ? liveMachines : DEMO_MACHINES;
  const demoMode = liveMachines.length === 0;
  const categories = Array.from(new Set(machines.map((machine) => machine.business.category)));

  return (
    <main className="container marketplace-page" style={{ paddingTop: "2.5rem", paddingBottom: "4rem" }}>
      <section className="glass-card marketplace-hero" style={{ padding: "1.5rem", marginBottom: "1.25rem" }}>
        <span className="eyebrow">CQA BUSINESS MARKETPLACE</span>
        <h1 style={{ marginBottom: ".55rem" }}>Find a business. Enter their machine. Get it done.</h1>
        <p className="small" style={{ maxWidth: 850 }}>
          Browse independent businesses operating branded vending machines through Creative Quality Australia. Services, bookings, products, subscriptions and enquiries live inside each machine.
        </p>
        {demoMode ? (
          <div className="marketplace-preview-note">
            <strong>Marketplace preview:</strong> the listings below are demonstrations. Real approved businesses will replace or sit alongside these examples as they join CQA.
          </div>
        ) : null}
      </section>

      <section className="category-rail" aria-label="Marketplace categories">
        <span className="button ghost" style={{ cursor: "default" }}>All businesses</span>
        {categories.map((category) => <span key={category} className="button ghost" style={{ cursor: "default" }}>{category}</span>)}
      </section>

      <section className="machine-grid-home">
        {machines.map((machine) => (
          <article className={`machine-card-home ${machine.theme || "cyan"}`} key={machine.slug}>
            <div className="machine-card-topline">
              <span>{machine.business.category}</span>
              <strong>{machine.demo ? "DEMO" : machine.business.verified ? "CQA VERIFIED" : "LISTED"}</strong>
            </div>
            <div className="machine-card-visual">
              <div className="machine-window"><span>{machine.business.name.slice(0, 2).toUpperCase()}</span></div>
              <div className="machine-dots">{Array.from({ length: 8 }).map((_, index) => <i key={index} />)}</div>
            </div>
            <h2>{machine.business.name}</h2>
            <p>{machine.business.description || machine.subtitle}</p>
            <p className="small"><strong>{machine.business.location_text || "Australia"}</strong> · {machine.offers.length} offer{machine.offers.length === 1 ? "" : "s"}</p>
            <ul>{machine.offers.slice(0, 3).map((offer) => <li key={offer.id}>{offer.name}</li>)}</ul>
            <Link href={`/machine/${machine.slug}`} className="card-link">Enter machine <span>→</span></Link>
          </article>
        ))}
      </section>

      <section className="final-panel" style={{ marginTop: "2rem" }}>
        <div>
          <span className="eyebrow">Own a business?</span>
          <h2>Put your business inside the marketplace.</h2>
          <p>Launch a branded machine, connect your own Stripe account and manage your offers from your private owner workspace.</p>
        </div>
        <Link href="/onboarding" className="button primary">Get My Machine</Link>
      </section>
    </main>
  );
}
