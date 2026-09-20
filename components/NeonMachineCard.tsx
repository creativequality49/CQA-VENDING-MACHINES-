import Link from "next/link";
import type { MarketplaceMachine } from "@/lib/cqa-marketplace";

function themeClass(theme?: string | null) {
  return ["pink", "cyan", "gold", "violet"].includes(theme || "") ? theme : "cyan";
}

export function NeonMachineCard({
  machine,
  compact = false,
}: {
  machine: MarketplaceMachine;
  compact?: boolean;
}) {
  const theme = themeClass(machine.theme);
  const visibleOffers = machine.offers.slice(0, compact ? 4 : 6);

  return (
    <article className={`neon-machine neon-machine-${theme} ${compact ? "neon-machine-compact" : ""}`}>
      <aside className="neon-machine-rail" aria-hidden="true">
        <span className="rail-logo">CQΛ</span>
        <div className="rail-meter">2·5</div>
        <span className="rail-label">PAYMENT</span>
        <div className="rail-payment"><b>Stripe</b><small>● ● ●</small></div>
        <span className="rail-label">PUSH</span>
        <div className="rail-push">PUSH</div>
        <span className="rail-label">COLLECT</span>
        <div className="rail-collect" />
        <span className="rail-label">STATUS</span>
        <div className="rail-status">ONLINE</div>
      </aside>

      <div className="neon-machine-main">
        <header className="neon-machine-header">
          <div>
            <span className="neon-kicker">{machine.business.category}</span>
            <h2>{machine.business.name}</h2>
          </div>
          <span className="neon-live"><i />{machine.demo ? "DEMO" : machine.business.verified ? "VERIFIED" : "LIVE"}</span>
        </header>

        <div className="neon-machine-screen">
          <span className="screen-title">{machine.title}</span>
          <strong>{machine.subtitle || machine.business.description || "Digital business vending machine"}</strong>
          <small>{machine.business.location_text || "Australia"} · {machine.offers.length} offer{machine.offers.length === 1 ? "" : "s"}</small>
        </div>

        <div className="neon-product-bay">
          {visibleOffers.map((offer, index) => (
            <div className="neon-product-slot" key={offer.id}>
              <span className="slot-number">{String(index + 1).padStart(2, "0")}</span>
              <div className="slot-icon">{offer.offer_type === "subscription" ? "∞" : offer.offer_type === "booking" ? "□" : offer.offer_type === "quote" ? "✦" : "◆"}</div>
              <strong>{offer.name}</strong>
              <small>{offer.price_cents === null ? "QUOTE" : new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(offer.price_cents / 100)}</small>
            </div>
          ))}
          {visibleOffers.length < (compact ? 4 : 6)
            ? Array.from({ length: (compact ? 4 : 6) - visibleOffers.length }).map((_, index) => (
                <div className="neon-product-slot slot-empty" key={`empty-${index}`}>
                  <span className="slot-number">+</span>
                  <div className="slot-icon">CQΛ</div>
                  <strong>READY SLOT</strong>
                  <small>ADD OFFER</small>
                </div>
              ))
            : null}
        </div>

        <footer className="neon-machine-footer">
          <div>
            <span>SECURE MACHINE</span>
            <strong>{machine.business.plan.toUpperCase()} · CQA</strong>
          </div>
          <Link href={`/machine/${machine.slug}`} className="neon-enter-button">
            ENTER MACHINE <span>→</span>
          </Link>
        </footer>
      </div>
    </article>
  );
}
