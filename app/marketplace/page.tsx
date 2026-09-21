import Link from "next/link";
import { NeonMachineCard } from "@/components/NeonMachineCard";
import { DEMO_MACHINES, getPublicSupabaseClient, type MarketplaceMachine } from "@/lib/cqa-marketplace";

async function getLiveMachines(): Promise<MarketplaceMachine[]> {
  try {
    const supabase = getPublicSupabaseClient();
    const { data, error } = await supabase
      .from("cqa_machines")
      .select("id,slug,title,subtitle,theme,assistant_enabled,template_key,template_locked,layout_version,hero_image_url,customization,business:cqa_businesses!inner(id,name,slug,category,description,location_text,logo_url,plan,featured,verified),offers:cqa_offers(id,name,description,offer_type,price_cents,currency,stripe_price_id,image_url,source_provider,fulfillment_type,shipping_required,external_url)")
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
          <span className="eyebrow">CQA DIGITAL VENDING MARKETPLACE</span>
          <h1>Walk into a marketplace of businesses built as machines.</h1>
          <p>The CQA Activewear machine is the visual master. Every business keeps the premium black-glass vending architecture while changing the brand, products, services, memberships, media and automation behind it.</p>
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

      <section className="marketplace-system-strip" aria-label="CQA machine system">
        <div><span>01</span><strong>CHOOSE A MACHINE</strong><small>Products, services, bookings or memberships</small></div>
        <div><span>02</span><strong>ENTER THE STOREFRONT</strong><small>Browse the business inside the CQA shell</small></div>
        <div><span>03</span><strong>BUY OR BOOK</strong><small>Secure payment or enquiry flow</small></div>
      </section>

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
