import type { MachinePreview, VendingSlot } from "@/components/vending/types";

type DbMachine = { slug: string; name: string; description: string | null; products?: DbProduct[] };
type DbProduct = { id: string; title: string; description: string | null; tier: string; priceAud: number; stripePriceId: string | null; productType?: string; accessType?: string };

export const fallbackSlots: VendingSlot[] = [
  { id: "starter-pass", title: "Starter Pass", priceLabel: "$19/mo", kind: "subscription", tierLabel: "Basic" },
  { id: "pro-vault", title: "Pro Vault", priceLabel: "$49/mo", kind: "subscription", tierLabel: "Pro" },
  { id: "elite-access", title: "Elite Access", priceLabel: "$99/mo", kind: "subscription", tierLabel: "Elite" },
  { id: "digital-product", title: "Digital Product", priceLabel: "$29", kind: "product", tierLabel: "One-off" },
];

export const liveMachineExamples: MachinePreview[] = [
  { slug: "fitness-coach", title: "Fitness Coach Machine", logoText: "FIT", category: "Fitness Coach", accent: "#00cfff", slots: [
    { id: "fit-basic", title: "Basic Fitness Pass", priceLabel: "$19/mo", kind: "subscription" },
    { id: "fit-pro", title: "Pro Training Vault", priceLabel: "$49/mo", kind: "subscription" },
    { id: "fit-elite", title: "Elite Coaching Access", priceLabel: "$99/mo", kind: "subscription" },
    { id: "fit-plan", title: "Meal Plan PDF", priceLabel: "$29", kind: "product" },
  ] },
  { slug: "ai-creator", title: "AI Creator Machine", logoText: "AI", category: "Creator Tools", accent: "#7a5cff", slots: [
    { id: "ai-starter", title: "Starter Prompt Vault", priceLabel: "$19/mo", kind: "subscription" },
    { id: "ai-pro", title: "Pro Creator System", priceLabel: "$49/mo", kind: "subscription" },
    { id: "ai-os", title: "Automation OS", priceLabel: "$149/mo", kind: "subscription" },
    { id: "ai-pack", title: "Prompt Pack", priceLabel: "$39", kind: "product" },
  ] },
  { slug: "spiritual-guide", title: "Spiritual Guide Machine", logoText: "SG", category: "Spiritual Guide", accent: "#ffcc33", slots: [
    { id: "sp-basic", title: "Monthly Guidance Pass", priceLabel: "$19/mo", kind: "subscription" },
    { id: "sp-vault", title: "Manifestation Vault", priceLabel: "$49/mo", kind: "subscription" },
    { id: "sp-private", title: "Private Rituals Access", priceLabel: "$99/mo", kind: "subscription" },
    { id: "sp-reading", title: "Recorded Reading", priceLabel: "$44", kind: "service" },
  ] },
  { slug: "activewear-brand", title: "Activewear Brand Machine", logoText: "AW", category: "Activewear Brand", accent: "#ff008c", slots: [
    { id: "aw-vip", title: "VIP Drop Club", priceLabel: "$19/mo", kind: "subscription" },
    { id: "aw-style", title: "Style Box Membership", priceLabel: "$49/mo", kind: "subscription" },
    { id: "aw-premium", title: "Premium Brand Club", priceLabel: "$99/mo", kind: "subscription" },
    { id: "aw-drop", title: "Limited Drop", priceLabel: "$89", kind: "product" },
  ] },
  { slug: "education-resource", title: "Education Resource Machine", logoText: "EDU", category: "Education", accent: "#00f0ff", slots: fallbackSlots },
  { slug: "beauty-business", title: "Beauty Business Machine", logoText: "BB", category: "Beauty", accent: "#ff7bd3", slots: fallbackSlots },
];

export function slotsFromProducts(products: DbProduct[] = []): VendingSlot[] {
  const mapped = products.slice(0, 12).map((product): VendingSlot => {
    const isSubscription = product.productType === "SUBSCRIPTION" || product.accessType === "subscription" || product.tier?.toLowerCase().includes("subscription");
    return {
      id: product.id,
      title: product.title,
      description: product.description,
      priceLabel: isSubscription ? `$${product.priceAud}/mo` : `$${product.priceAud}`,
      kind: isSubscription ? "subscription" : "product",
      tierLabel: product.tier,
      stripeReady: Boolean(product.stripePriceId),
      productId: product.id,
    };
  });
  return mapped.length >= 4 ? mapped : [...mapped, ...fallbackSlots].slice(0, 4);
}

export function machineFromDb(machine: DbMachine, index = 0): MachinePreview {
  const accents = ["#ff008c", "#00cfff", "#7a5cff", "#ffcc33", "#00f0ff"];
  return {
    slug: machine.slug,
    title: machine.name,
    logoText: machine.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 3).toUpperCase(),
    category: machine.description ?? "Brand vending machine",
    description: machine.description,
    accent: accents[index % accents.length],
    slots: slotsFromProducts(machine.products),
  };
}
