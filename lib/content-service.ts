import { prisma } from "./prisma";
import { isAdminRole, type CqaUser } from "./auth";
import { isDatabaseConfigured } from "./env";

export async function safeQuery<T>(fallback: T, query: () => Promise<T>) {
  if (!isDatabaseConfigured()) return fallback;
  try {
    return await query();
  } catch (error) {
    console.error("Database query failed", error);
    return fallback;
  }
}

export async function getStoreProducts(machineSlug?: string) {
  return safeQuery([], () =>
    prisma.product.findMany({
      where: { status: "active", machine: machineSlug ? { slug: machineSlug } : undefined },
      include: { machine: true },
      orderBy: [{ priceAud: "asc" }, { createdAt: "desc" }],
    }),
  );
}

export async function getMachineWithProducts(slug: string) {
  return safeQuery(null, () =>
    prisma.machine.findUnique({
      where: { slug },
      include: { products: { where: { status: "active" }, orderBy: { priceAud: "asc" } } },
    }),
  );
}

export async function hasContentAccess(user: CqaUser | null, content: { accessType: string; assignedProductId: string | null; assignedMachineId: string | null; assignedSubscriptionTier: string | null }) {
  if (content.accessType === "free") return true;
  if (isAdminRole(user?.role)) return true;
  if (!user || !isDatabaseConfigured()) return false;

  const entitlement = await prisma.customerEntitlement.findFirst({
    where: {
      userId: user.id,
      status: "active",
      OR: [
        content.assignedProductId ? { productId: content.assignedProductId } : {},
        content.assignedMachineId ? { machineId: content.assignedMachineId } : {},
        content.assignedSubscriptionTier ? { accessType: "subscription" } : {},
        { accessType: "bundle" },
      ],
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }],
    },
  });

  return Boolean(entitlement);
}

export async function getVaultSections(user: CqaUser | null) {
  const now = new Date();
  const visibleContent = await safeQuery([], () =>
    prisma.contentItem.findMany({
      where: {
        status: "published",
        accessType: { not: "admin" },
        OR: [{ releaseDate: null }, { releaseDate: { lte: now } }],
        AND: [{ OR: [{ expiryDate: null }, { expiryDate: { gt: now } }] }],
      },
      include: { product: true, machine: true },
      orderBy: { createdAt: "desc" },
    }),
  );

  const withAccess = await Promise.all(
    visibleContent.map(async (item) => ({ ...item, unlocked: await hasContentAccess(user, item) })),
  );

  const bundles = await safeQuery([], () =>
    prisma.contentBundle.findMany({ where: { status: "published" }, include: { machine: true }, orderBy: { createdAt: "desc" } }),
  );

  return {
    myDownloads: withAccess.filter((item) => item.unlocked && item.accessType !== "free"),
    newDrops: withAccess.filter((item) => item.unlocked).slice(0, 6),
    purchasedBundles: bundles,
    subscriptionVault: withAccess.filter((item) => item.accessType === "subscription"),
    recentlyAdded: withAccess.slice(0, 8),
    lockedPremium: withAccess.filter((item) => !item.unlocked),
  };
}

export async function getAdminStats() {
  return safeQuery(null, async () => {
    const [products, subscriptions, machines, contentItems, scheduledDrops, pendingReviews, publishedContent, drafts, orders] = await Promise.all([
      prisma.product.count(),
      prisma.customerEntitlement.count({ where: { accessType: "subscription", status: "active" } }),
      prisma.machine.count(),
      prisma.contentItem.count(),
      prisma.contentDrop.count({ where: { status: "scheduled" } }),
      prisma.contentItem.count({ where: { status: "review" } }),
      prisma.contentItem.count({ where: { status: "published" } }),
      prisma.contentItem.count({ where: { status: "draft" } }),
      prisma.order.aggregate({ _count: true, _sum: { amountAud: true } }),
    ]);

    return {
      revenue: orders._sum.amountAud ?? 0,
      orders: orders._count,
      products,
      subscriptions,
      machines,
      contentItems,
      scheduledDrops,
      pendingReviews,
      publishedContent,
      drafts,
    };
  });
}
