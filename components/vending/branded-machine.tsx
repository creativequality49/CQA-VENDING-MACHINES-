import type { CSSProperties } from "react";
import Link from "next/link";
import { MachineControlPanel } from "./machine-control-panel";
import { ProductSlot } from "./product-slot";
import { SubscriptionSlot } from "./subscription-slot";
import type { MachinePreview } from "./types";

export function BrandedMachine({ machine, href, featured = false }: { machine: MachinePreview; href?: string; featured?: boolean }) {
  const visibleSlots = machine.slots.slice(0, featured ? 4 : 4);
  return (
    <article className={`branded-machine ${featured ? "featured-machine" : ""}`} style={{ "--machine-accent": machine.accent } as CSSProperties}>
      <header className="machine-topper">
        <div className="brand-logo-area">{machine.logoText}</div>
        <div>
          <p className="machine-category">{machine.category}</p>
          <h3>{machine.title}</h3>
        </div>
      </header>
      <div className="machine-glass">
        <div className="machine-slots">
          {visibleSlots.map((slot) => slot.kind === "subscription" ? <SubscriptionSlot key={slot.id} slot={slot} /> : <ProductSlot key={slot.id} slot={slot} />)}
        </div>
        <MachineControlPanel />
      </div>
      <footer className="collection-tray">
        <span>Collection tray ready</span>
        {href ? <Link className="cta" href={href}>View Machine</Link> : <Link className="cta" href="/pricing">Rent Your Machine</Link>}
      </footer>
    </article>
  );
}
