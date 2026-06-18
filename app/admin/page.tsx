import Link from "next/link";
import { getCurrentUser, isAdminRole } from "@/lib/auth";
import { isDatabaseConfigured, isSupabaseConfigured } from "@/lib/env";
import { getOperationsMetrics } from "@/services/analytics.service";

export const dynamic = "force-dynamic";

const cards = [
  ["Orders", "/admin/orders"], ["Products", "/admin/products"], ["Inventory", "/admin/inventory"], ["Fulfillment", "/admin/fulfillment"], ["Subscriptions", "/admin/subscriptions"], ["Customers", "/admin/customers"], ["Reports", "/admin/reports"], ["Top Products", "/admin/reports/top-products"], ["Content Admin", "/admin/content"], ["Upload Content", "/admin/content/new"], ["Scheduled Drops", "/admin/content/drops"], ["Bundles", "/admin/bundles"], ["Settings", "/admin/settings"],
];

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!isAdminRole(user?.role)) return <main className="container"><section className="glass-card" style={{padding:"1rem"}}><h1>Admin access required</h1></section></main>;
  const metrics = isDatabaseConfigured() ? await getOperationsMetrics() : null;
  const values = metrics ?? { todaySales: 0, todayRevenue: 0, totalRevenue: 0, activeSubscriptions: 0, pendingOrders: 0, ordersNeedingFulfillment: 0, lowStockProducts: 0, failedPayments: 0, deliveryIssues: 0 };
  return <main className="container" style={{paddingBottom:"2rem"}}><section className="glass-card hero"><h1 className="section-title glow">CQA Operations Command Centre</h1>{!isDatabaseConfigured() || !isSupabaseConfigured() ? <p className="warning">Setup warning: configure DATABASE_URL, Supabase URL, service role key, and private storage bucket.</p> : null}</section><section className="grid grid-3">{Object.entries(values).filter(([,value])=>typeof value!=="object").map(([label,value])=><article className="glass-card" style={{padding:"1rem"}} key={label}><p className="small">{label}</p><strong>{String(label).toLowerCase().includes("revenue") ? `$${value} AUD` : String(value)}</strong></article>)}</section><h2>Operations</h2><section className="grid grid-3">{cards.map(([label,href])=><Link className="glass-card admin-link" style={{padding:"1rem"}} key={href} href={href}>{label}</Link>)}</section>{metrics?.recentOrders?.length ? <><h2>Recent Orders</h2><section className="ops-table">{metrics.recentOrders.map(order=><article className="glass-card" style={{padding:"1rem"}} key={order.id}><strong>{order.orderNumber}</strong><p className="small">{order.paymentStatus} • {order.fulfillmentStatus} • ${order.totalAmount}</p></article>)}</section></> : null}</main>;
}
