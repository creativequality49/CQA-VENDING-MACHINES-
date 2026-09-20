import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketplaceCheckoutButton } from "@/components/MarketplaceCheckoutButton";
import { DEMO_MACHINES, formatAud, getPublicSupabaseClient, type MarketplaceMachine } from "@/lib/cqa-marketplace";

async function getLiveMachine(slug: string): Promise<MarketplaceMachine | null> {
  try {
    const supabase = getPublicSupabaseClient();
    const { data, error } = await supabase
      .from("cqa_machines")
      .select("id,slug,title,subtitle,theme,assistant_enabled,business:cqa_businesses!inner(id,name,slug,category,description,location_text,logo_url,plan,featured,verified),offers:cqa_offers(id,name,description,offer_type,price_cents,currency,stripe_price_id)")
      .eq("slug", slug)
      .eq("status", "live")
      .single();
    if (error || !data) return null;
    return data as unknown as MarketplaceMachine;
  } catch {
    return null;
  }
}

function themeClass(theme?: string | null) {
  if (theme === "purple") return "violet";
  if (theme === "aqua") return "cyan";
  if (theme === "rose") return "pink";
  return ["pink", "cyan", "gold", "violet"].includes(theme || "") ? theme : "cyan";
}

export default async function MachinePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const live = await getLiveMachine(slug);
  const machine = live || DEMO_MACHINES.find((item) => item.slug === slug);
  if (!machine) notFound();

  const theme = themeClass(machine.theme);

  return (
    <main className={`container machine-detail-page machine-theme-${theme}`} style={{ paddingTop: "2.5rem", paddingBottom: "4rem" }}>
      <section className="machine-detail-shell">
        <aside className="machine-detail-rail" aria-hidden="true">
          <span className="rail-logo">CQΛ</span>
          <div className="rail-meter">2·5</div>
          <span className="rail-label">PAYMENT</span>
          <div className="rail-payment"><b>Stripe</b><small>VISA · MC · PAY</small></div>
          <span className="rail-label">PRODUCT</span>
          <div className="rail-product-port">▣</div>
          <span className="rail-label">PUSH</span>
          <div className="rail-push">PUSH</div>
          <span className="rail-label">COLLECT</span>
          <div className="rail-collect" />
          <span className="rail-label">STATUS</span>
          <div className="rail-status">ONLINE</div>
        </aside>

        <div className="machine-detail-main">
          <header className="machine-detail-header">
            <div>
              <span className="eyebrow">{machine.business.category} · CQA BUSINESS MACHINE</span>
              <h1>{machine.business.name}</h1>
              <p>{machine.business.description || machine.subtitle}</p>
            </div>
            <div className="machine-detail-live">
              <span><i /> {machine.demo ? "DEMO" : "LIVE"}</span>
              <small>{machine.business.location_text || "Australia"}</small>
            </div>
          </header>

          <section className="machine-detail-screen">
            <div>
              <span>WELCOME TO</span>
              <strong>{machine.title}</strong>
              <small>{machine.business.verified ? "CQA VERIFIED MACHINE" : "CQA MARKETPLACE MACHINE"}</small>
            </div>
            <div className="machine-screen-stats">
              <div><b>{machine.offers.length}</b><span>OFFERS</span></div>
              <div><b>{machine.business.plan.toUpperCase()}</b><span>PLAN</span></div>
              <div><b>{machine.assistant_enabled ? "ON" : "OFF"}</b><span>AI HELP</span></div>
            </div>
          </section>

          {machine.demo ? (
            <div className="machine-demo-banner">DEMO MODE · No payment is taken for demonstration offers.</div>
          ) : null}

          <section className="machine-offer-bay">
            {machine.offers.map((offer, index) => {
              const bookingLike = ["service", "booking", "quote", "consultation"].includes(offer.offer_type);
              return (
                <article key={offer.id} className="machine-offer-slot">
                  <span className="slot-number">{String(index + 1).padStart(2, "0")}</span>
                  <div className="slot-icon">{offer.offer_type === "subscription" ? "∞" : offer.offer_type === "booking" ? "□" : offer.offer_type === "quote" ? "✦" : "◆"}</div>
                  <span className="slot-type">{offer.offer_type.replaceAll("_", " ")}</span>
                  <h2>{offer.name}</h2>
                  <strong className="slot-price">{formatAud(offer.price_cents)}</strong>
                  <p>{offer.description || "Available through this business machine."}</p>
                  <div className="slot-action">
                    {machine.demo ? (
                      <Link className="neon-enter-button" href={`/book?machine=${encodeURIComponent(machine.slug)}&offer=${encodeURIComponent(offer.id)}&demo=1`}>
                        TRY DEMO →
                      </Link>
                    ) : bookingLike ? (
                      <Link className="neon-enter-button" href={`/book?machine=${encodeURIComponent(machine.slug)}&offer=${encodeURIComponent(offer.id)}`}>
                        {offer.offer_type === "quote" ? "REQUEST QUOTE →" : "BOOK / ENQUIRE →"}
                      </Link>
                    ) : (
                      <MarketplaceCheckoutButton machineSlug={machine.slug} offerId={offer.id} label={offer.offer_type === "subscription" ? "START SUBSCRIPTION" : "BUY WITH STRIPE"} />
                    )}
                  </div>
                </article>
              );
            })}
          </section>

          <footer className="machine-detail-footer">
            <div><span>INSTANT ACCESS</span><small>Secure customer flow</small></div>
            <div><span>STRIPE READY</span><small>Connected payments</small></div>
            <div><span>OWNER CONTROLLED</span><small>Private dashboard</small></div>
            <div><span>AI OPTIONAL</span><small>Approval-gated workers</small></div>
          </footer>
        </div>
      </section>

      {machine.assistant_enabled ? (
        <section className="glass-card machine-assistant-panel">
          <div><span className="eyebrow">BUSINESS ASSISTANT</span><h2>Need help choosing a slot?</h2><p className="small">Send a guided enquiry to the business. Sensitive actions remain human-approved during the CQA rollout.</p></div>
          <Link href={`/book?machine=${encodeURIComponent(machine.slug)}&offer=general`} className="button primary">Ask this business</Link>
        </section>
      ) : null}

      <div className="machine-detail-links">
        <Link href="/marketplace" className="text-link">← Back to marketplace</Link>
        <Link href="/onboarding" className="text-link">Build my own CQA machine →</Link>
      </div>
    </main>
  );
}
