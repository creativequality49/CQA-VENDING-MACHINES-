import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const machines = [
  { name: "CQA Core Store", slug: "store", description: "Automated digital storefront systems selling 24/7." },
  { name: "Scarlett May Vault", slug: "scarlett-vault", description: "Luxury AI influencer products, premium drops, and private automation." },
  { name: "Pink Machine", slug: "pink", description: "Starter AI agent machine." },
  { name: "Blue Machine", slug: "blue", description: "Pro automation machine." },
  { name: "Gold Machine", slug: "gold", description: "Elite AI empire machine." },
];

async function main() {
  for (const machine of machines) {
    await prisma.machine.upsert({ where: { slug: machine.slug }, update: machine, create: { ...machine, status: "active" } });
  }

  const store = await prisma.machine.findUniqueOrThrow({ where: { slug: "store" } });
  await prisma.product.upsert({
    where: { slug: "starter-machine" },
    update: {},
    create: { machineId: store.id, title: "Starter Machine", slug: "starter-machine", description: "Launch your first AI vending machine funnel.", tier: "starter", priceAud: 69, accessType: "one_time", status: "active" },
  });
  await prisma.product.upsert({
    where: { slug: "pro-automation-machine" },
    update: {},
    create: { machineId: store.id, title: "Pro Automation Machine", slug: "pro-automation-machine", description: "Automation stack, upsells, and premium vault access.", tier: "pro", priceAud: 169, accessType: "subscription", status: "active" },
  });
}

main().finally(() => prisma.$disconnect());
