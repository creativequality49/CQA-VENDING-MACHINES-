import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime="nodejs";

export async function POST(request:NextRequest){
  const form=await request.formData();
  const email=String(form.get("email")||"").slice(0,320);
  const category=String(form.get("category")||"").slice(0,180);
  const contentUrl=String(form.get("contentUrl")||"").slice(0,1200);
  const details=String(form.get("details")||"").slice(0,8000);
  if(!email||!category||!details)return NextResponse.json({error:"Missing required report fields."},{status:400});
  const apiKey=process.env.RESEND_API_KEY;const to=process.env.SAFETY_REPORT_EMAIL;
  if(!apiKey||!to)return NextResponse.json({error:"Safety-report delivery is not configured."},{status:503});
  const resend=new Resend(apiKey);
  await resend.emails.send({from:"FanXFantasy Safety <onboarding@resend.dev>",to,replyTo:email,subject:`FanXFantasy safety report: ${category}`,text:`Reporter: ${email}\nCategory: ${category}\nContent reference: ${contentUrl||"Not supplied"}\n\nDetails:\n${details}\n\nSafety note: do not request or forward unlawful imagery by email.`});
  return NextResponse.redirect(new URL("/compliance?report=submitted",request.url),303);
}
