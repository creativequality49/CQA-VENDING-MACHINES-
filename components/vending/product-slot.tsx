import { CheckoutButton } from "@/components/CheckoutButton";
import type { VendingSlot } from "./types";

export function ProductSlot({ slot }: { slot: VendingSlot }) {
  const label = slot.kind === "service" ? "Book" : slot.kind === "membership" ? "Unlock" : "Buy";
  return (
    <div className="vend-slot vend-slot-product">
      <span className="slot-badge">{slot.kind === "service" ? "SERVICE" : slot.kind === "membership" ? "MEMBERSHIP" : "PRODUCT"}</span>
      <h4>{slot.title}</h4>
      <p>{slot.description ?? "One-off vending machine offer."}</p>
      <strong>{slot.priceLabel}</strong>
      {slot.productId && slot.stripeReady ? <CheckoutButton productId={slot.productId} label={label} /> : <button className="slot-button" disabled>{label}</button>}
    </div>
  );
}
