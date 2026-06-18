import { MachineRentalCard } from "@/components/vending/machine-rental-card";

const plans = [
  { name: "Starter Machine", price: "AUD $29/mo", features: ["Brand logo", "Custom colours", "4 product/subscription slots", "CQA hosted machine URL"] },
  { name: "Pro Machine", price: "AUD $79/mo", features: ["20 slots", "Analytics", "Lead capture", "Custom machine theme", "Featured marketplace listing"], badge: "MOST POPULAR" },
  { name: "Elite Machine", price: "AUD $199/mo", features: ["Unlimited slots", "AI assistant", "CRM/export tools", "Advanced analytics", "Priority support", "White-label options"], badge: "WHITE LABEL READY" },
];

export default function Page(){return <main className="container"><section className="pricing-machine-frame glass-card"><p className="small">CQA platform pricing</p><h1 className="section-title glow">Machine Rental Plans</h1><p className="hero-copy">Rent a branded digital vending machine, add your logo, load your products and sell subscriptions through a high-converting neon storefront.</p><div className="rental-grid">{plans.map((plan)=><MachineRentalCard key={plan.name} {...plan}/>)}</div></section></main>}
