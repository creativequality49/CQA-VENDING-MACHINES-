import { FulfillmentStatus, InventoryMovementType, NotificationSeverity, OrderType, PaymentStatus, ProductType, type Order, type Product } from "@prisma/client";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { grantDigitalAccess } from "./digital-access.service";
import { createPhysicalFulfillmentTask } from "./fulfillment.service";
import { assertPurchasable, moveInventory } from "./inventory.service";
import { createNotification } from "./notifications.service";
import { logActivity } from "./audit-log.service";

function getOrderType(productTypes: ProductType[]) {
  const unique = new Set(productTypes);
  if (unique.size > 1) return OrderType.MIXED;
  const only = productTypes[0];
  if (only === ProductType.PHYSICAL) return OrderType.PHYSICAL;
  if (only === ProductType.SUBSCRIPTION) return OrderType.SUBSCRIPTION;
  return OrderType.DIGITAL;
}

function needsDigital(productType: ProductType) {
  return productType === ProductType.DIGITAL || productType === ProductType.SUBSCRIPTION;
}

function needsPhysical(productType: ProductType) {
  return productType === ProductType.PHYSICAL;
}

export async function createOrderFromCheckoutSession(session: Stripe.Checkout.Session) {
  const productId = session.metadata?.productId;
  if (!productId) throw new Error("Missing productId metadata");
  const rootProduct = await prisma.product.findUnique({ where: { id: productId }, include: { bundleComponents: { include: { componentProduct: true } } } });
  if (!rootProduct) throw new Error(`Product not found: ${productId}`);

  const components = rootProduct.productType === ProductType.BUNDLE ? rootProduct.bundleComponents.map((component) => ({ product: component.componentProduct, quantity: component.quantity })) : [];
  const fulfillableProducts = components.length ? components : [{ product: rootProduct, quantity: 1 }];
  for (const item of fulfillableProducts) await assertPurchasable(item.product, item.quantity);

  const productTypes = fulfillableProducts.map((item) => item.product.productType);
  const orderType = rootProduct.productType === ProductType.BUNDLE ? getOrderType(productTypes) : getOrderType([rootProduct.productType]);
  const amount = session.amount_total ?? rootProduct.price ?? rootProduct.priceAud;
  const orderNumber = `CQA-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${session.id.slice(-8).toUpperCase()}`;
  const stripeCustomerId = typeof session.customer === "string" ? session.customer : null;
  const stripeSubscriptionId = typeof session.subscription === "string" ? session.subscription : null;
  const stripePaymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;

  const existing = await prisma.order.findUnique({ where: { stripeCheckoutSessionId: session.id }, include: { items: true } });
  if (existing) return existing;

  const order = await prisma.order.create({
    data: {
      orderNumber,
      customerId: session.metadata?.customerId || session.metadata?.userId || null,
      userId: session.metadata?.userId || null,
      productId: rootProduct.id,
      stripeCustomerId,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId,
      stripeSubscriptionId,
      totalAmount: amount,
      amountAud: amount,
      currency: (session.currency ?? rootProduct.currency).toUpperCase(),
      paymentStatus: PaymentStatus.PAID,
      fulfillmentStatus: orderType === OrderType.PHYSICAL || orderType === OrderType.MIXED ? FulfillmentStatus.AWAITING_FULFILLMENT : FulfillmentStatus.COMPLETED,
      orderType,
      customerEmail: session.customer_details?.email ?? session.customer_email ?? null,
      shippingAddress: session.customer_details?.address ? JSON.parse(JSON.stringify(session.customer_details.address)) : undefined,
      billingAddress: session.customer_details?.address ? JSON.parse(JSON.stringify(session.customer_details.address)) : undefined,
      status: "paid",
      stripeSessionId: session.id,
      items: {
        create: [{
          productId: rootProduct.id,
          productNameSnapshot: rootProduct.name ?? rootProduct.title,
          skuSnapshot: rootProduct.sku,
          quantity: 1,
          unitPrice: amount,
          totalPrice: amount,
          productType: rootProduct.productType,
          fulfillmentRequired: rootProduct.productType === ProductType.PHYSICAL || fulfillableProducts.some((item) => needsPhysical(item.product.productType)),
          digitalAccessGranted: false,
        }],
      },
    },
    include: { items: true },
  });

  for (const item of fulfillableProducts) await fulfillPaidProduct(order, item.product, item.quantity, stripeCustomerId, stripeSubscriptionId);
  await prisma.orderItem.updateMany({ where: { orderId: order.id }, data: { digitalAccessGranted: true } });
  await createNotification({ type: "NEW_PAID_ORDER", title: "New paid order", message: `${order.orderNumber} paid successfully`, relatedEntityType: "Order", relatedEntityId: order.id });
  await logActivity({ entityType: "Order", entityId: order.id, action: "order.created_from_checkout", newValue: order });
  return order;
}

async function fulfillPaidProduct(order: Order, product: Product, quantity: number, stripeCustomerId: string | null, stripeSubscriptionId: string | null) {
  if (needsDigital(product.productType)) {
    await grantDigitalAccess({ customerId: order.customerId ?? order.userId, product, orderId: order.id, subscriptionId: stripeSubscriptionId });
  }
  if (needsPhysical(product.productType)) {
    await moveInventory({ productId: product.id, movementType: InventoryMovementType.SALE, quantityChange: -quantity, reason: `Sale ${order.orderNumber}`, orderId: order.id });
    await createPhysicalFulfillmentTask({ order, packingNotes: product.fulfillmentInstructions });
  }
  await prisma.customerEntitlement.create({ data: { userId: order.userId, productId: product.id, machineId: product.machineId, stripeCustomerId, stripeSubscriptionId, accessType: product.accessType, status: "active" } });
}

export async function markPaymentFailed(paymentIntentId: string) {
  const order = await prisma.order.updateMany({ where: { stripePaymentIntentId: paymentIntentId }, data: { paymentStatus: PaymentStatus.FAILED, status: "failed" } });
  await createNotification({ type: "FAILED_PAYMENT", title: "Payment failed", message: `Payment intent ${paymentIntentId} failed`, severity: NotificationSeverity.WARNING });
  return order;
}

export async function markOrderRefunded(paymentIntentId: string) {
  const order = await prisma.order.findFirst({ where: { stripePaymentIntentId: paymentIntentId }, include: { items: true } });
  if (!order) return null;
  await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: PaymentStatus.REFUNDED, status: "refunded" } });
  await prisma.digitalAccess.updateMany({ where: { orderId: order.id }, data: { accessStatus: "REVOKED" } });
  await prisma.customerEntitlement.updateMany({ where: { userId: order.userId, productId: order.productId }, data: { status: "revoked", expiresAt: new Date() } });
  await logActivity({ entityType: "Order", entityId: order.id, action: "order.refunded" });
  return order;
}
