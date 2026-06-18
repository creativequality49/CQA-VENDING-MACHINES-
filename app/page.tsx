import Link from "next/link";
import { BrandedMachine } from "@/components/vending/branded-machine";
import { HowItWorks } from "@/components/vending/how-it-works";
import { MachinePreviewGrid } from "@/components/vending/machine-preview-grid";
import { MachineRentalCard } from "@/components/vending/machine-rental-card";
import { liveMachineExamples } from "@/lib/vending-examples";

const rentalPlans = [
  { name: "Starter Machine", price: "AUD $29/mo", features: ["Brand logo", "Custom colours", "4 product/subscription slots", "CQA hosted machine URL"] },
  { name: "Pro Machine", price: "AUD $79/mo", features: ["20 slots", "Analytics", "Lead capture", "Custom machine theme", "Featured marketplace listing"], badge: "MOST POPULAR" },
  { name: "Elite Machine", price: "AUD $199/mo", features: ["Unlimited slots", "AI assistant", "CRM/export tools", "Advanced analytics", "Priority support", "White-label options"], badge: "WHITE LABEL READY" },
];

export default function Home() {
  return (
    <main className="container vending-platform-home">
      <section className="hero platform-hero glass-card">
        <div>
          <p className="small">CQA Vending OS for creators, coaches, brands and service providers</p>
          <h1 className="section-title glow">Rent A Digital Vending Machine For Your Brand</h1>
          <p className="hero-copy">Launch a branded storefront that sells products, services and subscriptions through a neon vending-machine experience.</p>
          <div className="hero-cta"><Link href="/pricing" className="cta">Rent Your Machine</Link><Link href="/machines" className="cta secondary">Browse Live Machines</Link></div>
        </div>
        <BrandedMachine machine={liveMachineExamples[0]} featured />
      </section>
      <section><h2>How It Works</h2><HowItWorks /></section>
      <section><h2>Machine Rental Plans</h2><div className="rental-grid">{rentalPlans.map((plan) => <MachineRentalCard key={plan.name} {...plan} />)}</div></section>
      <section><h2>Live Machine Examples</h2><MachinePreviewGrid machines={liveMachineExamples} /></section>
    </main>
  );
}
