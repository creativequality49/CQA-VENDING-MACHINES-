import { getEnv } from "./env";

export type Tier = "basic" | "pro" | "elite";

export const products = [
  {
    id: 1,
    tier: "basic" as const,
    name: "Basic",
    price: 69,
    description: "Foundational digital vending system.",
    stripePriceEnvKey: "STRIPE_BASIC_PRICE_ID" as const,
    filePath: "vault/basic.zip",
  },
  {
    id: 2,
    tier: "pro" as const,
    name: "Pro",
    price: 169,
    description: "Advanced funnels, automations, and templates.",
    stripePriceEnvKey: "STRIPE_PRO_PRICE_ID" as const,
    filePath: "vault/pro.zip",
  },
  {
    id: 3,
    tier: "elite" as const,
    name: "Elite",
    price: 1690,
    description: "Premium done-with-you scale framework.",
    stripePriceEnvKey: "STRIPE_ELITE_PRICE_ID" as const,
    filePath: "vault/elite.zip",
  },
];

export function getStripePriceId(productId: number) {
  const product = products.find((item) => item.id === productId);
  if (!product) return null;
  return getEnv()[product.stripePriceEnvKey];
}

export function findProductByPriceId(priceId: string) {
  return products.find((item) => getEnv()[item.stripePriceEnvKey] === priceId);
}

export function findProductById(productId: number) {
  return products.find((item) => item.id === productId);
}
