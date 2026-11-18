type CheckoutOffer = { offer_type?: unknown; fulfillment_type?: unknown; fulfillment_config?: unknown; shipping_required?: unknown };

/** Only sell workflows whose payment and fulfilment lifecycle is supported. */
export function getCqaOfferCheckoutHold(offer: CheckoutOffer): { code: string; message: string } | null {
  if (offer.offer_type === "subscription" || offer.fulfillment_type === "subscription")
    return { code: "CQA_SUBSCRIPTION_SETUP_PENDING", message: "Recurring purchases are not available yet. Contact this business about this offer." };
  if (offer.offer_type === "physical_product" || offer.fulfillment_type === "shipping" || offer.shipping_required === true)
    return { code: "CQA_SHIPPING_SETUP_PENDING", message: "Shipping checkout is not available yet. Contact this business about delivery." };
  if (!["digital_product", "service", "booking", "consultation"].includes(String(offer.offer_type)))
    return { code: "CQA_OFFER_SETUP_PENDING", message: "Contact this business to confirm the scope and price of this offer." };
  if (["service", "booking", "consultation"].includes(String(offer.offer_type)) || ["service", "booking"].includes(String(offer.fulfillment_type))) {
    const config = offer.fulfillment_config;
    if (!config || typeof config !== "object" || Array.isArray(config) ||
        !["deliveryDescription", "deliveryTiming", "supportDetails", "refundTerms"].every(key =>
          Object.hasOwn(config, key) && typeof (config as Record<string, unknown>)[key] === "string" &&
          Boolean(((config as Record<string, string>)[key]).trim()) &&
          ((config as Record<string, string>)[key]).length <= 5000))
      return { code: "CQA_FULFILLMENT_SETUP_PENDING", message: "This business must publish delivery, timing, support and refund details before accepting payment." };
  }
  return null;
}
