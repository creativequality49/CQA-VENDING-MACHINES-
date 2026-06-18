import { DigitalAccessStatus, type Prisma, type Product } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logActivity } from "./audit-log.service";

export async function grantDigitalAccess(input: { customerId?: string | null; product: Product; orderId?: string | null; subscriptionId?: string | null; tx?: Prisma.TransactionClient }) {
  const client = input.tx ?? prisma;
  const access = await client.digitalAccess.create({
    data: {
      customerId: input.customerId ?? null,
      productId: input.product.id,
      orderId: input.orderId ?? null,
      subscriptionId: input.subscriptionId ?? null,
      accessStatus: DigitalAccessStatus.ACTIVE,
    },
  });
  await client.customerEntitlement.create({
    data: {
      userId: input.customerId ?? null,
      productId: input.product.id,
      machineId: input.product.machineId,
      accessType: input.product.accessType,
      status: "active",
    },
  });
  await logActivity({ entityType: "DigitalAccess", entityId: access.id, action: "digital_access.granted", newValue: access });
  return access;
}

export async function revokeSubscriptionAccess(stripeSubscriptionId: string) {
  const subscription = await prisma.ecommerceSubscription.findUnique({ where: { stripeSubscriptionId } });
  if (!subscription) return;
  await prisma.digitalAccess.updateMany({ where: { subscriptionId: subscription.id }, data: { accessStatus: DigitalAccessStatus.EXPIRED, accessEndsAt: new Date() } });
  await prisma.customerEntitlement.updateMany({ where: { stripeSubscriptionId }, data: { status: "expired", expiresAt: new Date() } });
  await logActivity({ entityType: "EcommerceSubscription", entityId: subscription.id, action: "subscription.access_expired" });
}
