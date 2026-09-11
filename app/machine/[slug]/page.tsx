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

export default async function MachinePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const live = await getLiveMachine(slug);
  const machine = live || DEMO_MACHINES.find((item) => item.slug === slug);
  if (!machine) notFound();

  return (
    <main className="container" style={{ paddingTop: "2.5rem", paddingBottom: "4rem" }}>
      <section className="glass-card" style={{ padding: "1.5rem", marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "flex-start" }}>
          <div>
            <span className="eyebrow">{machine.business.category} · CQA BUSINESS MACHINE</span>
            <h1 style={{ marginBottom: ".5rem" }}>{machine.business.name}</h1>
            <p className="small" style={{ maxWidth: 760 }}>{machine.business.description || machine.subtitle}</p>
            <p className="small"><strong>{machine.business.location_text || "Australia"}</strong>{machine.business.verified ? " · CQA verified" : ""}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <span className="live-pill"><i /> {machine.demo ? "DEMO MACHINE" : "OPEN"}</span>
          </div>
        </div>
        {machine.demo ? (
          <div style={{ marginTop: "1rem", padding: ".8rem 1rem", borderRadius: 12, border: "1px solid rgba(255,190,90,.35)", background: "rgba(255,190,90,.08)" }}>
            This is a CQA demonstration machine showing how a customer business can appear. No payment is taken for demo offers.
          </div>
        ) : null}
      </section>

      <section className="grid grid-2">
        {machine.offers.map((offer) => {
          const bookingLike = ["service", "booking", "quote", "consultation"].includes(offer.offer_type);
          return (
            <article key={offer.id} className="glass-card" style={{ padding: "1.2rem", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
                <span className="eyebrow">{offer.offer_type.replaceAll("_", " ")}</span>
                <strong style={{ color: "#ff7bd3" }}>{formatAud(offer.price_cents)}</strong>
              </div>
              <h2 style={{ marginBottom: ".35rem" }}>{offer.name}</h2>
              <p className="small">{offer.description || "Available through this business machine."}</p>
              <div style={{ marginTop: "auto", paddingTop: ".8rem" }}>
                {machine.demo ? (
                  <Link className="button primary" href={`/book?machine=${encodeURIComponent(machine.slug)}&offer=${encodeURIComponent(offer.id)}&demo=1`} style={{ justifyContent: "center" }}>
                    Try demo request
                  </Link>
                ) : bookingLike ? (
                  <Link className="button primary" href={`/book?machine=${encodeURIComponent(machine.slug)}&offer=${encodeURIComponent(offer.id)}`} style={{ justifyContent: "center" }}>
                    {offer.offer_type === "quote" ? "Request quote" : "Book / enquire"}
                  </Link>
                ) : (
                  <MarketplaceCheckoutButton machineSlug={machine.slug} offerId={offer.id} label={offer.offer_type === "subscription" ? "Start subscription" : "Buy securely with Stripe"} />
                )}
              </div>
            </article>
          );
        })}
      </section>

      {machine.assistant_enabled ? (
        <section className="glass-card" style={{ padding: "1.25rem", marginTop: "1rem" }}>
          <span className="eyebrow">Business assistant</span>
          <h2>Need help choosing?</h2>
          <p className="small">This machine is configured to support guided customer enquiries. During pilot rollout, requests are collected for the business owner so sensitive actions stay human-approved.</p>
          <Link href={`/book?machine=${encodeURIComponent(machine.slug)}&offer=general`} className="button ghost">Ask this business</Link>
        </section>
      ) : null}

      <div style={{ marginTop: "1.25rem", display: "flex", gap: ".75rem", flexWrap: "wrap" }}>
        <Link href="/marketplace" className="text-link">← Back to marketplace</Link>
        <Link href="/onboarding" className="text-link">List my business with CQA →</Link>
      </div>
    </main>
  );
}
