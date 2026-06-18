import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { safeQuery } from "@/lib/content-service";
export const dynamic="force-dynamic";
export default async function Page(){const items=await safeQuery([],()=>prisma.contentItem.findMany({orderBy:{createdAt:"desc"},take:20}));return <main className="container"><h1>Content Admin</h1><div className="hero-cta"><Link className="cta" href="/admin/content/new">Upload Content</Link><Link className="cta secondary" href="/admin/content/library">Library</Link><Link className="cta secondary" href="/admin/content/drops">Drops</Link></div><section className="grid grid-2">{items.map(i=><Link href={`/admin/content/${i.id}`} className="glass-card" style={{padding:"1rem"}} key={i.id}><h3>{i.title}</h3><p className="small">{i.status} • {i.accessType}</p></Link>)}</section></main>}
