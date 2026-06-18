import { InventoryMovementType, NotificationSeverity, type Prisma, type Product } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logActivity } from "./audit-log.service";
import { createNotification } from "./notifications.service";

export function isStockManaged(product: Pick<Product, "productType" | "stockQuantity">) {
  return product.productType === "PHYSICAL" || product.stockQuantity > 0;
}

export async function assertPurchasable(product: Pick<Product, "productType" | "stockQuantity" | "reservedStockQuantity" | "title">, quantity = 1) {
  if (product.productType !== "PHYSICAL") return;
  const available = product.stockQuantity - product.reservedStockQuantity;
  if (available < quantity) throw new Error(`${product.title} is out of stock`);
}

export async function moveInventory(input: {
  productId: string;
  movementType: InventoryMovementType;
  quantityChange: number;
  reason: string;
  orderId?: string | null;
  staffId?: string | null;
  tx?: Prisma.TransactionClient;
}) {
  const client = input.tx ?? prisma;
  const product = await client.product.findUniqueOrThrow({ where: { id: input.productId } });
  const previousStock = product.stockQuantity;
  const newStock = previousStock + input.quantityChange;
  await client.product.update({ where: { id: product.id }, data: { stockQuantity: newStock } });
  const movement = await client.inventoryMovement.create({
    data: {
      productId: product.id,
      movementType: input.movementType,
      quantityChange: input.quantityChange,
      previousStock,
      newStock,
      reason: input.reason,
      orderId: input.orderId ?? null,
      staffId: input.staffId ?? null,
    },
  });
  if (newStock <= product.lowStockThreshold) {
    await createNotification({
      type: "LOW_STOCK",
      title: "Low stock alert",
      message: `${product.title} is at ${newStock} units`,
      severity: newStock <= 0 ? NotificationSeverity.CRITICAL : NotificationSeverity.WARNING,
      relatedEntityType: "Product",
      relatedEntityId: product.id,
    });
  }
  await logActivity({ entityType: "Product", entityId: product.id, action: `inventory.${input.movementType.toLowerCase()}`, previousValue: { stockQuantity: previousStock }, newValue: { stockQuantity: newStock, movementId: movement.id } });
  return movement;
}
