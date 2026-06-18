import { NotificationSeverity } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function createNotification(input: {
  type: string;
  title: string;
  message: string;
  severity?: NotificationSeverity;
  relatedEntityType?: string;
  relatedEntityId?: string;
}) {
  return prisma.notification.create({
    data: {
      type: input.type,
      title: input.title,
      message: input.message,
      severity: input.severity ?? NotificationSeverity.INFO,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
    },
  });
}
