import { PaymentStatus, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function getOperationsMetrics() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [todaySales, totalRevenue, activeSubscriptions, pendingOrders, fulfillment, lowStock, failedPayments, deliveryIssues, recentOrders] = await Promise.all([
    prisma.order.aggregate({ where: { createdAt: { gte: today }, paymentStatus: PaymentStatus.PAID }, _sum: { totalAmount: true }, _count: true }),
    prisma.order.aggregate({ where: { paymentStatus: PaymentStatus.PAID }, _sum: { totalAmount: true } }),
    prisma.ecommerceSubscription.count({ where: { status: SubscriptionStatus.ACTIVE } }),
    prisma.order.count({ where: { paymentStatus: PaymentStatus.PENDING } }),
    prisma.fulfillmentTask.count({ where: { status: { in: ["PENDING", "AWAITING_FULFILLMENT", "PICKING"] } } }),
    prisma.product.count({ where: { stockQuantity: { lte: prisma.product.fields.lowStockThreshold } } }),
    prisma.order.count({ where: { paymentStatus: PaymentStatus.FAILED } }),
    prisma.fulfillmentTask.count({ where: { status: "ISSUE_EXCEPTION" } }),
    prisma.order.findMany({ take: 10, orderBy: { createdAt: "desc" }, include: { items: true } }),
  ]);
  return { todaySales: todaySales._count, todayRevenue: todaySales._sum.totalAmount ?? 0, totalRevenue: totalRevenue._sum.totalAmount ?? 0, activeSubscriptions, pendingOrders, ordersNeedingFulfillment: fulfillment, lowStockProducts: lowStock, failedPayments, deliveryIssues, recentOrders };
}

export async function getTopProducts(limit = 50) {
  const rows = await prisma.orderItem.groupBy({
    by: ["productId", "productNameSnapshot"],
    _sum: { quantity: true, totalPrice: true },
    _count: { orderId: true },
    orderBy: { _sum: { totalPrice: "desc" } },
    take: limit,
  });
  return rows.map((row) => ({ productId: row.productId, name: row.productNameSnapshot, unitsSold: row._sum.quantity ?? 0, revenue: row._sum.totalPrice ?? 0, repeatPurchases: Math.max((row._count.orderId ?? 0) - 1, 0), sevenDayTrend: 0, thirtyDayTrend: 0, subscriptionSignups: 0 }));
}
