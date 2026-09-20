import Link from "next/link";
import { NeonMachineCard } from "@/components/NeonMachineCard";
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
    <main className="container marketplace-page neon-marketplace-page" style={{ paddingTop: "2.5rem", paddingBottom: "4rem" }}>
      <section className="marketplace-neon-hero">
        <div>
          <span className="eyebrow">CQA BUSINESS MACHINE MARKETPLACE</span>
          <h1>Every business gets the same premium machine architecture — with its own identity.</h1>
          <p>Browse branded vending machines for services, bookings, products and subscriptions. Each machine keeps the CQA black-glass structure while colours, offers and brand details change by business.</p>
        </div>
        <div className="marketplace-live-panel">
          <span><i /> MARKETPLACE LIVE</span>
          <strong>{machines.length}</strong>
          <small>machines visible</small>
        </div>
      </section>

      {demoMode ? (
        <div className="marketplace-preview-note">
          <strong>Marketplace preview:</strong> these are demonstration businesses. Approved live businesses appear here automatically after CQA review.
        </div>
      ) : null}

      <section className="category-rail neon-category-rail" aria-label="Marketplace categories">
        <span className="button ghost" style={{ cursor: "default" }}>ALL MACHINES</span>
        {categories.map((category) => <span key={category} className="button ghost" style={{ cursor: "default" }}>{category.toUpperCase()}</span>)}
      </section>

      <section className="neon-machine-grid marketplace-machine-grid">
        {machines.map((machine) => <NeonMachineCard machine={machine} key={machine.slug} />)}
      </section>

      <section className="final-panel" style={{ marginTop: "2rem" }}>
        <div>
          <span className="eyebrow">OWN A BUSINESS?</span>
          <h2>Put your business inside a CQA machine.</h2>
          <p>Choose the plan, customise the machine, connect Stripe and manage the operation from your private owner workspace.</p>
        </div>
        <Link href="/onboarding" className="button primary">Build My Machine</Link>
      </section>
    </main>
  );
}
