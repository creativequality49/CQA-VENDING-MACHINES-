import { prisma } from "@/lib/prisma";
import { isDatabaseConfigured } from "@/lib/env";
import { MachinePreviewGrid } from "@/components/vending/machine-preview-grid";
import { liveMachineExamples, machineFromDb } from "@/lib/vending-examples";

export const dynamic = "force-dynamic";

export default async function Page() {
  const dbMachines = isDatabaseConfigured() ? await prisma.machine.findMany({ where: { status: "active" }, include: { products: { where: { OR: [{ status: "active" }, { status: "ACTIVE" }] }, orderBy: { priceAud: "asc" } } }, orderBy: { createdAt: "desc" }, take: 12 }).catch(() => []) : [];
  const machines = dbMachines.length ? dbMachines.map((machine, index) => machineFromDb(machine, index)) : liveMachineExamples;
  return <main className="container"><section className="glass-card hero"><p className="small">CQA hosted branded vending machines</p><h1 className="section-title glow">Browse Live Machines</h1><p className="hero-copy">Every machine is a brand storefront with product slots, service offers and monthly subscription memberships.</p></section><MachinePreviewGrid machines={machines} /></main>;
}
