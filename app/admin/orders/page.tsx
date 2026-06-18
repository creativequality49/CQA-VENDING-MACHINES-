import { prisma } from "@/lib/prisma";
import { safeQuery } from "@/lib/content-service";
export const dynamic = "force-dynamic";
export default async function Page(){const orders=await safeQuery([],()=>prisma.order.findMany({include:{items:true},orderBy:{createdAt:"desc"},take:100}));return <main className="container"><h1>Orders</h1><div className="ops-table">{orders.map(o=><article className="glass-card" style={{padding:"1rem"}} key={o.id}><strong>{o.orderNumber}</strong><p className="small">{o.customerEmail ?? o.customerId ?? "No customer"} • {o.paymentStatus} • {o.fulfillmentStatus} • ${o.totalAmount} {o.currency}</p><p className="small">{o.items.map(i=>i.productNameSnapshot).join(", ")}</p></article>)}</div></main>}
