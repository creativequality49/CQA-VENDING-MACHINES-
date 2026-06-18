import { FulfillmentStatus, FulfillmentTaskStatus, NotificationSeverity, Priority, type Order, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logActivity } from "./audit-log.service";
import { createNotification } from "./notifications.service";

export async function createPhysicalFulfillmentTask(input: { order: Order; packingNotes?: string | null; tx?: Prisma.TransactionClient }) {
  const client = input.tx ?? prisma;
  const task = await client.fulfillmentTask.create({
    data: {
      orderId: input.order.id,
      status: FulfillmentTaskStatus.AWAITING_FULFILLMENT,
      priority: Priority.NORMAL,
      packingNotes: input.packingNotes,
    },
  });
  await client.order.update({ where: { id: input.order.id }, data: { fulfillmentStatus: FulfillmentStatus.AWAITING_FULFILLMENT } });
  await createNotification({ type: "FULFILLMENT_REQUIRED", title: "Order awaiting fulfillment", message: `Order ${input.order.orderNumber} needs packing`, severity: NotificationSeverity.WARNING, relatedEntityType: "Order", relatedEntityId: input.order.id });
  await logActivity({ entityType: "FulfillmentTask", entityId: task.id, action: "fulfillment.created", newValue: task });
  return task;
}

export async function updateFulfillmentTask(taskId: string, data: { status?: FulfillmentTaskStatus; assignedToStaffId?: string | null; trackingNumber?: string | null; courier?: string | null; internalNotes?: string | null }) {
  const previous = await prisma.fulfillmentTask.findUniqueOrThrow({ where: { id: taskId } });
  const now = new Date();
  const task = await prisma.fulfillmentTask.update({
    where: { id: taskId },
    data: {
      ...data,
      packedAt: data.status === FulfillmentTaskStatus.PACKED || data.status === FulfillmentTaskStatus.READY_TO_SHIP ? now : undefined,
      shippedAt: data.status === FulfillmentTaskStatus.SHIPPED ? now : undefined,
      deliveredAt: data.status === FulfillmentTaskStatus.DELIVERED ? now : undefined,
    },
  });
  if (data.status) {
    const map: Partial<Record<FulfillmentTaskStatus, FulfillmentStatus>> = {
      PICKING: FulfillmentStatus.PICKING,
      PACKED: FulfillmentStatus.PACKED,
      SHIPPED: FulfillmentStatus.SHIPPED,
      DELIVERED: FulfillmentStatus.DELIVERED,
      ISSUE_EXCEPTION: FulfillmentStatus.ISSUE_EXCEPTION,
    };
    const status = map[data.status];
    if (status) await prisma.order.update({ where: { id: task.orderId }, data: { fulfillmentStatus: status } });
  }
  await logActivity({ entityType: "FulfillmentTask", entityId: task.id, action: "fulfillment.updated", previousValue: previous, newValue: task });
  return task;
}
