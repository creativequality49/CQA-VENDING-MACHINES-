import { Machine } from "./types";

export const tierDisplayOrder = ["basic", "pro", "elite", "subscription"] as const;

export const machines: Machine[] = [
  {
    slug: "scarlett-vault",
    title: "Scarlett May Vault",
    subtitle: "Luxury AI influencer products, premium drops, and private content automation.",
    products: [
      { id: "scarlett-starter", title: "Starter Vault", description: "Prompt packs + aesthetic templates.", tier: "basic", priceLabel: "$97", assetKey: "scarlett/starter.zip" },
      { id: "scarlett-pro", title: "Pro Monetization Kit", description: "Fan funnel scripts and growth blueprints.", tier: "pro", priceLabel: "$297", assetKey: "scarlett/pro.zip" },
      { id: "scarlett-elite", title: "Elite Private Vault", description: "Done-for-you launch stack + coaching assets.", tier: "elite", priceLabel: "$997", assetKey: "scarlett/elite.zip" },
      { id: "scarlett-sub", title: "Scarlett Recurring Drop Club", description: "Daily premium drops and subscriber exclusives.", tier: "subscription", priceLabel: "$49/mo", assetKey: "scarlett/subscription-feed.json", subscriberOnly: true },
    ],
  },
  {
    slug: "store",
    title: "CQA Core Store",
    subtitle: "Automated digital storefront systems selling 24/7 for premium creators.",
    products: [
      { id: "store-basic", title: "Basic Machine Blueprint", description: "Launch your first vending machine in 24h.", tier: "basic", priceLabel: "$79", assetKey: "store/basic.zip" },
      { id: "store-pro", title: "Pro Revenue Engine", description: "Conversion scripts + funnel assets + upsell stack.", tier: "pro", priceLabel: "$249", assetKey: "store/pro.zip" },
      { id: "store-elite", title: "Elite Licensing Pack", description: "Whitelabel bundle and premium support templates.", tier: "elite", priceLabel: "$899", assetKey: "store/elite.zip" },
      { id: "store-sub", title: "Monthly Content Drops", description: "Recurring content drops and conversion updates.", tier: "subscription", priceLabel: "$39/mo", assetKey: "store/subscription-feed.json", subscriberOnly: true },
    ],
  },
];

export function getMachine(slug: string) {
  return machines.find((machine) => machine.slug === slug);
}

export function getProductById(productId: string) {
  return machines.flatMap((m) => m.products).find((p) => p.id === productId);
}
