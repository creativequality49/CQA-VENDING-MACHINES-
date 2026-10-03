export type CqaAutomationOffer = {
  id: string;
  name: string;
  category: "package" | "worker" | "industry" | "custom";
  setupAud: number | null;
  monthlyAud: number | null;
  description: string;
  features: readonly string[];
  paymentUrl: string | null;
};

export const CQA_AUTOMATION_OFFERS: readonly CqaAutomationOffer[] = [
  {
    id: "automation_starter",
    name: "Automation Starter",
    category: "package",
    setupAud: 497,
    monthlyAud: 99,
    description: "One production automation built, connected and maintained for a focused business workflow.",
    features: ["1 production automation", "Initial workflow setup", "Connected business tools", "Ongoing monitoring and maintenance"],
    paymentUrl: "https://buy.stripe.com/00w9AL3Tqa4H41q4hK2Nq0f"
  },
  {
    id: "automation_pro",
    name: "Automation Pro",
    category: "package",
    setupAud: 897,
    monthlyAud: 249,
    description: "Up to three connected automations working together across your sales, marketing or operations.",
    features: ["Up to 3 connected automations", "Cross-workflow handoffs", "Priority configuration", "Ongoing monitoring and maintenance"],
    paymentUrl: "https://buy.stripe.com/dRm5kvblS2Cf41qeWo2Nq0g"
  },
  {
    id: "ai_business_operations",
    name: "AI Business Operations",
    category: "package",
    setupAud: 1997,
    monthlyAud: 449,
    description: "A connected AI operations layer combining AI workers, integrations and business automations.",
    features: ["AI worker system", "Multi-step automations", "Business integrations", "Priority implementation support"],
    paymentUrl: "https://buy.stripe.com/8x2fZ989G0u7btS8y02Nq0h"
  },
  {
    id: "ai_lead_finder",
    name: "AI Lead Finder",
    category: "worker",
    setupAud: 497,
    monthlyAud: 99,
    description: "Collects, structures and qualifies prospective customers into a usable sales pipeline.",
    features: ["Lead collection", "AI qualification", "Structured lead records", "Pipeline-ready outputs"],
    paymentUrl: "https://buy.stripe.com/3cIdR1gGc2Cf69y3dG2Nq0i"
  },
  {
    id: "ai_content_marketing_worker",
    name: "AI Content & Marketing Worker",
    category: "worker",
    setupAud: 497,
    monthlyAud: 129,
    description: "Turns your offers and brand inputs into a repeatable content and marketing workflow.",
    features: ["Content planning", "Marketing copy generation", "Campaign workflow", "Approval-ready outputs"],
    paymentUrl: "https://buy.stripe.com/14A28j0HeccP1Ti8y02Nq0j"
  },
  {
    id: "ai_customer_follow_up_worker",
    name: "AI Customer Follow-Up Worker",
    category: "worker",
    setupAud: 397,
    monthlyAud: 99,
    description: "Automates structured follow-up for leads and customers so opportunities are not left untouched.",
    features: ["Lead follow-up", "Customer follow-up", "Status-based sequences", "Escalation-ready workflow"],
    paymentUrl: "https://buy.stripe.com/28E7sDdu0gt5fK8eWo2Nq0k"
  },
  {
    id: "ai_receptionist",
    name: "AI Receptionist",
    category: "worker",
    setupAud: 797,
    monthlyAud: 249,
    description: "Handles common enquiries, captures customer details and routes or prepares booking requests.",
    features: ["Enquiry handling", "Lead capture", "Qualification", "Booking or routing workflow"],
    paymentUrl: "https://buy.stripe.com/14A7sDgGc5Or55u8y02Nq0l"
  },
  {
    id: "competitor_market_monitor",
    name: "Competitor & Market Monitor",
    category: "worker",
    setupAud: 497,
    monthlyAud: 129,
    description: "Monitors permitted market sources for relevant changes and turns them into structured business intelligence.",
    features: ["Market monitoring", "Change detection", "Structured reports", "Business alerts"],
    paymentUrl: "https://buy.stripe.com/7sY14ffC8fp19lKg0s2Nq0m"
  },
  {
    id: "product_order_automation_worker",
    name: "Product & Order Automation Worker",
    category: "worker",
    setupAud: 697,
    monthlyAud: 149,
    description: "Coordinates product administration, order status and fulfilment hand-offs across connected systems.",
    features: ["Product administration", "Order workflow", "Fulfilment hand-offs", "Customer status handling"],
    paymentUrl: "https://buy.stripe.com/fZu28jfC890DapO3dG2Nq0n"
  },
  {
    id: "real_estate_property_intelligence_worker",
    name: "Real Estate Property Intelligence Worker",
    category: "industry",
    setupAud: 997,
    monthlyAud: 249,
    description: "Collects permitted property-listing data, structures it and monitors relevant property changes and criteria.",
    features: ["Permitted listing-data collection", "Property filtering", "Change monitoring", "Structured alerts and exports"],
    paymentUrl: "https://buy.stripe.com/14AeV59dK2Cf1Tig0s2Nq0o"
  },
  {
    id: "custom_automation_system",
    name: "Custom Automation System",
    category: "custom",
    setupAud: null,
    monthlyAud: null,
    description: "A custom-scoped automation system for complex workflows, integrations and business-specific requirements.",
    features: ["Custom implementation", "Complex integrations", "Tailored workflow design", "Quoted support and maintenance"],
    paymentUrl: null
  }
] as const;

export function firstPaymentAud(offer: CqaAutomationOffer) {
  if (offer.setupAud === null || offer.monthlyAud === null) return null;
  return offer.setupAud + offer.monthlyAud;
}
