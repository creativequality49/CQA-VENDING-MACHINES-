import { CheckoutButton } from "@/components/CheckoutButton";
import type { VendingSlot } from "./types";

export function SubscriptionSlot({ slot }: { slot: VendingSlot }) {
  return (
    <div className="vend-slot vend-slot-subscription">
      <span className="slot-badge monthly">MONTHLY</span>
      <h4>{slot.title}</h4>
      <p>{slot.description ?? "Recurring brand membership access."}</p>
      <strong>{slot.priceLabel}</strong>
      {slot.productId && slot.stripeReady ? <CheckoutButton productId={slot.productId} label="Subscribe" /> : <button className="slot-button" disabled>Subscribe</button>}
    </div>
  );
}
