/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { AGE_COOKIE, verifyAgeToken } from "@/lib/age-assurance";
import { requireFanXUser, bearerError } from "@/lib/fanx-auth";
import { getStripeClient } from "@/lib/stripe";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";

type Kind = "subscription" | "product" | "post" | "tip";
type CheckoutBody = { kind?: Kind; creatorSlug?: string; itemKey?: string; amountCents?: number };

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}
function siteUrl(request: Request) { return (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, ""); }

export async function POST(request: Request) {
  try {
    if (!verifyAgeToken(cookieValue(request, AGE_COOKIE))) return NextResponse.json({ error: "Verified age assurance is required." }, { status: 403 });
    const user = await requireFanXUser(request);
    const body = (await request.json().catch(() => ({}))) as CheckoutBody;
    const kind = body.kind;
    const creatorSlug = String(body.creatorSlug || "scarlett-may");
    const itemKey = String(body.itemKey || "").trim();
    if (!kind || !["subscription", "product", "post", "tip"].includes(kind)) return NextResponse.json({ error: "Invalid checkout type." }, { status: 400 });

    const db = getSupabaseAdminClient() as any;
    const { data: creator, error: creatorError } = await db.from("fanx_creators").select("id,slug,display_name,stripe_account_id,payout_mode,status").eq("slug", creatorSlug).eq("status", "active").maybeSingle();
    if (creatorError) throw new Error(creatorError.message);
    if (!creator) return NextResponse.json({ error: "Creator not found." }, { status: 404 });

    let itemId: string | null = null; let title = "FanXFantasy purchase"; let amount = 0; let interval: "month" | "year" | null = null;
    if (kind === "subscription") {
      const { data: tier, error } = await db.from("fanx_tiers").select("id,name,price_cents,billing_interval").eq("creator_id", creator.id).ilike("name", itemKey || "Premium").eq("active", true).maybeSingle();
      if (error) throw new Error(error.message); if (!tier) return NextResponse.json({ error: "Subscription tier not found." }, { status: 404 });
      itemId=tier.id; title=`${creator.display_name} — ${tier.name}`; amount=Number(tier.price_cents); interval=tier.billing_interval === "year" ? "year" : "month";
    } else if (kind === "product") {
      const { data: product, error } = await db.from("fanx_products").select("id,title,price_cents").eq("creator_id",creator.id).eq("slug",itemKey).eq("active",true).maybeSingle();
      if(error) throw new Error(error.message); if(!product) return NextResponse.json({error:"Product not found."},{status:404}); itemId=product.id;title=product.title;amount=Number(product.price_cents);
    } else if (kind === "post") {
      const { data: post, error } = await db.from("fanx_posts").select("id,title,price_cents").eq("creator_id",creator.id).eq("id",itemKey).eq("status","published").maybeSingle();
      if(error) throw new Error(error.message); if(!post) return NextResponse.json({error:"Post not found."},{status:404}); itemId=post.id;title=post.title||`${creator.display_name} premium post`;amount=Number(post.price_cents);
    } else { amount=Math.max(100,Math.min(100000,Math.round(Number(body.amountCents||1000)))); title=`Tip to ${creator.display_name}`; }
    if(!Number.isFinite(amount)||amount<50) return NextResponse.json({error:"Invalid price."},{status:400});

    const platformFee=Math.round(amount*.2); const creatorNet=amount-platformFee;
    const {data:order,error:orderError}=await db.from("fanx_orders").insert({fan_user_id:user.id,creator_id:creator.id,kind,status:"pending",currency:"aud",gross_cents:amount,platform_fee_cents:platformFee,creator_net_cents:creatorNet,metadata:{item_id:itemId,item_key:itemKey,title}}).select("id").single();
    if(orderError) throw new Error(orderError.message);
    await db.from("fanx_order_items").insert({order_id:order.id,item_type:kind==="subscription"?"tier":kind,item_id:itemId,title,quantity:1,unit_amount_cents:amount});

    const metadata:Record<string,string>={system:"fanx",orderId:order.id,fanUserId:user.id,creatorId:creator.id,creatorSlug,kind,itemId:itemId||"",itemKey};
    const connected=creator.payout_mode==="stripe_connect"&&creator.stripe_account_id; const stripe=getStripeClient();
    const checkout=await stripe.checkout.sessions.create({
      mode:kind==="subscription"?"subscription":"payment",
      line_items:[{quantity:1,price_data:{currency:"aud",unit_amount:amount,product_data:{name:title},...(kind==="subscription"?{recurring:{interval:interval||"month"}}:{})}}],
      success_url:`${siteUrl(request)}/fanxfantasy/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:`${siteUrl(request)}/fanxfantasy/${kind==="subscription"?"tiers":"marketplace"}`,
      customer_email:user.email||undefined,client_reference_id:user.id,metadata,allow_promotion_codes:kind!=="tip",
      ...(kind==="subscription"?{subscription_data:{metadata,...(connected?{application_fee_percent:20,transfer_data:{destination:creator.stripe_account_id}}:{})}}:{payment_intent_data:{metadata,receipt_email:user.email||undefined,...(connected?{application_fee_amount:platformFee,transfer_data:{destination:creator.stripe_account_id}}:{})}})
    });
    await db.from("fanx_orders").update({stripe_checkout_session_id:checkout.id,updated_at:new Date().toISOString()}).eq("id",order.id);
    return NextResponse.json({url:checkout.url,orderId:order.id});
  } catch(error) { const auth=bearerError(error); return NextResponse.json({error:auth.message},{status:auth.status}); }
}
