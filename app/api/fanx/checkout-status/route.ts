import { NextResponse } from "next/server";
import { requireFanXUser,bearerError } from "@/lib/fanx-auth";
import { getFanXDb } from "@/lib/fanx-db";
import { getStripeClient } from "@/lib/stripe";

export const runtime="nodejs";

export async function GET(request:Request){
 try{
  const user=await requireFanXUser(request);const url=new URL(request.url);const sessionId=url.searchParams.get("session_id")||"";if(!sessionId.startsWith("cs_"))return NextResponse.json({error:"Invalid checkout session."},{status:400});
  const session=await getStripeClient().checkout.sessions.retrieve(sessionId);if(session.metadata?.system!=="fanx"||session.client_reference_id!==user.id)return NextResponse.json({error:"Checkout session does not belong to this account."},{status:403});
  const orderId=session.metadata?.orderId;if(!orderId)return NextResponse.json({error:"Order reference missing."},{status:404});
  const db=getFanXDb();const {data:order,error}=await db.from("fanx_orders").select("id,kind,status,gross_cents,platform_fee_cents,creator_net_cents,currency,created_at,metadata").eq("id",orderId).eq("fan_user_id",user.id).maybeSingle();if(error)throw new Error(error.message);if(!order)return NextResponse.json({error:"Order not found."},{status:404});
  const complete=order.status==="paid";return NextResponse.json({complete,order,paymentStatus:session.payment_status,checkoutStatus:session.status});
 }catch(error){const e=bearerError(error);return NextResponse.json({error:e.message},{status:e.status})}
}
