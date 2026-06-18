import { notFound } from "next/navigation";
import { BrandedMachine } from "@/components/vending/branded-machine";
import { getMachineWithProducts } from "@/lib/content-service";
import { liveMachineExamples, machineFromDb } from "@/lib/vending-examples";

export const dynamic = "force-dynamic";

export default async function MachineDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const dbMachine = await getMachineWithProducts(slug);
  const fallback = liveMachineExamples.find((machine) => machine.slug === slug);
  const machine = dbMachine ? machineFromDb(dbMachine) : fallback;
  if (!machine) notFound();
  return (
    <main className="container machine-detail-page">
      <section className="machine-storefront-shell">
        <div className="machine-detail-copy">
          <p className="small">CQA hosted vending link</p>
          <h1 className="section-title glow">{machine.title}</h1>
          <p className="hero-copy">Products, services and brand memberships are merchandised as neon vending slots. Select a slot, pay securely, then unlock access through the customer dashboard.</p>
        </div>
        <BrandedMachine machine={machine} featured />
      </section>
    </main>
  );
}
