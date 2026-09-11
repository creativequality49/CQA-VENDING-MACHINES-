import { createClient } from "@supabase/supabase-js";

export type PlanKey = "starter" | "pro" | "elite";
export type OfferType = "service" | "booking" | "physical_product" | "digital_product" | "subscription" | "quote" | "consultation";

export type MarketplaceOffer = {
  id: string;
  name: string;
  description: string | null;
  offer_type: OfferType;
  price_cents: number | null;
  currency: string;
  stripe_price_id?: string | null;
};

export type MarketplaceMachine = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  theme: string;
  assistant_enabled: boolean;
  business: {
    id: string;
    name: string;
    slug: string;
    category: string;
    description: string | null;
    location_text: string | null;
    logo_url: string | null;
    plan: PlanKey;
    featured: boolean;
    verified: boolean;
  };
  offers: MarketplaceOffer[];
  demo?: boolean;
};

export const CQA_PLANS = [
  {
    key: "starter" as const,
    name: "Starter",
    price: 49,
    fee: 5,
    slots: "4 selling slots",
    features: ["Hosted CQA machine", "Products or services", "Lead capture", "Basic owner dashboard", "AI Business Planner available"]
  },
  {
    key: "pro" as const,
    name: "Pro",
    price: 99,
    fee: 3,
    slots: "20 selling slots",
    features: ["Everything in Starter", "Bookings + subscriptions", "Analytics", "Custom machine theme", "Sales and support workers available"]
  },
  {
    key: "elite" as const,
    name: "Elite",
    price: 249,
    fee: 1,
    slots: "Unlimited selling slots",
    features: ["Everything in Pro", "Dedicated AI assistant", "CRM/export tools", "Finance worker access", "Priority CQA support"]
  }
];

export const CQA_WORKERS = [
  ["receptionist", "AI Receptionist", 49, "Answers common questions, captures leads and prepares booking requests."],
  ["sales", "AI Sales Worker", 69, "Qualifies leads, recommends offers and prepares follow-ups for approval."],
  ["business-planner", "AI Business Planner", 49, "Builds business plans, SWOTs, goals and review actions from owner input."],
  ["stocktake", "AI Stocktake Worker", 59, "Tracks stock signals and prepares reorder recommendations."],
  ["finance", "AI Finance Assistant", 79, "Summarises sales and finance admin and flags items requiring human review."],
  ["support", "AI Customer Support", 59, "Triages support requests and drafts customer replies for approval."]
] as const;

export const DEMO_MACHINES: MarketplaceMachine[] = [
  {
    id: "demo-plumbing",
    slug: "demo-summit-plumbing",
    title: "Summit Plumbing Machine",
    subtitle: "Book plumbing services, request quotes and organise maintenance in one place.",
    theme: "cyan",
    assistant_enabled: true,
    demo: true,
    business: { id: "demo-business-1", name: "Summit Plumbing Co.", slug: "summit-plumbing", category: "Trades", description: "Residential plumbing and hot-water services.", location_text: "South Australia", logo_url: null, plan: "pro", featured: true, verified: true },
    offers: [
      { id: "demo-p1", name: "Emergency Plumbing", description: "Request urgent plumbing assistance.", offer_type: "booking", price_cents: null, currency: "aud" },
      { id: "demo-p2", name: "Hot Water Service", description: "Book a hot-water inspection or repair.", offer_type: "booking", price_cents: 18900, currency: "aud" },
      { id: "demo-p3", name: "Get a Quote", description: "Send job details and request a tailored quote.", offer_type: "quote", price_cents: null, currency: "aud" }
    ]
  },
  {
    id: "demo-beauty",
    slug: "demo-luna-beauty",
    title: "Luna Beauty Machine",
    subtitle: "Appointments, memberships and retail products from one branded storefront.",
    theme: "pink",
    assistant_enabled: true,
    demo: true,
    business: { id: "demo-business-2", name: "Luna Beauty Studio", slug: "luna-beauty", category: "Beauty", description: "Beauty appointments, memberships and aftercare products.", location_text: "Adelaide, SA", logo_url: null, plan: "elite", featured: true, verified: true },
    offers: [
      { id: "demo-b1", name: "Signature Treatment", description: "Reserve a signature studio appointment.", offer_type: "booking", price_cents: 12900, currency: "aud" },
      { id: "demo-b2", name: "VIP Membership", description: "Monthly member benefits and priority booking.", offer_type: "subscription", price_cents: 7900, currency: "aud" }
    ]
  },
  {
    id: "demo-fitness",
    slug: "demo-forge-fitness",
    title: "Forge Fitness Machine",
    subtitle: "Sessions, programs and recurring coaching plans.",
    theme: "gold",
    assistant_enabled: true,
    demo: true,
    business: { id: "demo-business-3", name: "Forge Fitness", slug: "forge-fitness", category: "Fitness", description: "Personal training and structured coaching programs.", location_text: "Australia", logo_url: null, plan: "pro", featured: false, verified: true },
    offers: [
      { id: "demo-f1", name: "1:1 Training Session", description: "Book an individual training session.", offer_type: "booking", price_cents: 8500, currency: "aud" },
      { id: "demo-f2", name: "Monthly Coaching", description: "Recurring coaching and accountability program.", offer_type: "subscription", price_cents: 14900, currency: "aud" }
    ]
  }
];

const fallbackUrl = "https://rjxiuukphwybujuclenn.supabase.co";
const fallbackPublishableKey = "sb_publishable_eycv4056PKiBgUMYrA1sHA_dRCIMMBb";

export function getPublicSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || fallbackUrl;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || fallbackPublishableKey;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function getBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || fallbackUrl;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || fallbackPublishableKey;
  return createClient(url, key);
}

export function formatAud(cents: number | null) {
  if (cents === null) return "Request quote";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(cents / 100);
}

export function platformFeePercent(plan: PlanKey) {
  return plan === "elite" ? 1 : plan === "pro" ? 3 : 5;
}
