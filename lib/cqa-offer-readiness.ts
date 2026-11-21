// Stripe Checkout shipping-address country allowlist (pinned SDK).
export const supportedShippingCountries = new Set(["AC", "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AT", "AU", "AW", "AX", "AZ", "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS", "BT", "BV", "BW", "BY", "BZ", "CA", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN", "CO", "CR", "CV", "CW", "CY", "CZ", "DE", "DJ", "DK", "DM", "DO", "DZ", "EC", "EE", "EG", "EH", "ER", "ES", "ET", "FI", "FJ", "FK", "FO", "FR", "GA", "GB", "GD", "GE", "GF", "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY", "HK", "HN", "HR", "HT", "HU", "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IS", "IT", "JE", "JM", "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN", "KR", "KW", "KY", "KZ", "LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MF", "MG", "MK", "ML", "MM", "MN", "MO", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA", "NC", "NE", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ", "OM", "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PY", "QA", "RE", "RO", "RS", "RU", "RW", "SA", "SB", "SC", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS", "ST", "SV", "SX", "SZ", "TA", "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO", "TR", "TT", "TV", "TW", "TZ", "UA", "UG", "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VN", "VU", "WF", "WS", "XK", "YE", "YT", "ZA", "ZM", "ZW", "ZZ"]);
export type CheckoutOffer = { offer_type?: unknown; fulfillment_type?: unknown; fulfillment_config?: unknown; shipping_required?: unknown };

/** Only sell workflows whose payment and fulfilment lifecycle is supported. */
export function getCqaOfferCheckoutHold(offer: CheckoutOffer): { code: string; message: string } | null {
  if (offer.offer_type === "subscription" || offer.fulfillment_type === "subscription")
    return { code: "CQA_SUBSCRIPTION_SETUP_PENDING", message: "Recurring purchases are not available yet. Contact this business about this offer." };
  if (offer.offer_type === "physical_product" || offer.fulfillment_type === "shipping" || offer.shipping_required === true) {
    if (offer.offer_type !== "physical_product" || offer.fulfillment_type !== "shipping" || !physicalShippingConfig(offer.fulfillment_config))
      return { code: "CQA_SHIPPING_SETUP_PENDING", message: "This business must configure merchant dispatch, shipping destinations and delivery terms before accepting payment." };
  }
  if (!["digital_product", "physical_product", "service", "booking", "consultation"].includes(String(offer.offer_type)))
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

export function physicalShippingConfig(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const config = value as Record<string, unknown>;
  const shipping = config.shipping && typeof config.shipping === "object" && !Array.isArray(config.shipping) ? config.shipping as Record<string, unknown> : {};
  if (config.provider !== "merchant" || !Array.isArray(shipping.supportedRegions) || !shipping.supportedRegions.length || shipping.supportedRegions.length > 30 ||
      !shipping.supportedRegions.every(country => typeof country === "string" && supportedShippingCountries.has(country)) ||
      typeof shipping.dispatchTiming !== "string" || !shipping.dispatchTiming.trim() || shipping.dispatchTiming.length > 1000 ||
      !Number.isSafeInteger(shipping.flatFeeCents) || Number(shipping.flatFeeCents) < 0 || Number(shipping.flatFeeCents) > 1000000 ||
      !["deliveryDescription", "deliveryTiming", "supportDetails", "refundTerms"].every(key => typeof config[key] === "string" && Boolean((config[key] as string).trim()) && (config[key] as string).length <= 5000)) return null;
  return { provider: "merchant" as const, shippingCountries: [...new Set(shipping.supportedRegions as string[])], shippingRateCents: Number(shipping.flatFeeCents) };
}
