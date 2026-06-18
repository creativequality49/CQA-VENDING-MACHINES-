import Link from "next/link";
import { getOperationsMetrics } from "@/services/analytics.service";
export const dynamic="force-dynamic";
export default async function Page(){const m=await getOperationsMetrics();const cards=["todaySales","todayRevenue","totalRevenue","activeSubscriptions","pendingOrders","ordersNeedingFulfillment","lowStockProducts","failedPayments","deliveryIssues"] as const;return <main className="container"><h1>Reports</h1><Link className="cta" href="/admin/reports/top-products">Top 50 Daily Products</Link><section className="grid grid-3" style={{marginTop:"1rem"}}>{cards.map(k=><article className="glass-card" style={{padding:"1rem"}} key={k}><p className="small">{k}</p><strong>{m[k]}</strong></article>)}</section></main>}
