import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest){
  const apiKey=process.env.YOTI_AGE_API_KEY;
  const sdkId=process.env.YOTI_SDK_ID;
  if(!apiKey||!sdkId||!process.env.AGE_GATE_SECRET){
    return NextResponse.redirect(new URL("/age-check?error=Age+assurance+is+not+configured",request.url),303);
  }
  const form=await request.formData().catch(()=>null);
  const requested=String(form?.get("returnTo")||"/fanxfantasy");
  const returnTo=requested.startsWith("/")?requested:"/fanxfantasy";
  const origin=new URL(request.url).origin;
  const callback=`${origin}/api/age/callback?returnTo=${encodeURIComponent(returnTo)}`;
  const cancel=`${origin}/age-check?returnTo=${encodeURIComponent(returnTo)}`;
  const response=await fetch("https://age.yoti.com/api/v1/sessions",{
    method:"POST",
    headers:{Authorization:`Bearer ${apiKey}`,"Yoti-Sdk-Id":sdkId,"Content-Type":"application/json"},
    body:JSON.stringify({
      type:"OVER",ttl:900,
      age_estimation:{allowed:true,threshold:21,level:"PASSIVE",retry_limit:2},
      digital_id:{allowed:true,threshold:18,age_estimation_allowed:true,age_estimation_threshold:21,retry_limit:2},
      doc_scan:{allowed:true,threshold:18,authenticity:"AUTO",level:"PASSIVE",retry_limit:2},
      credit_card:{allowed:false,retry_limit:1},mobile:{allowed:false,retry_limit:1},
      reference_id:`cqa_${Date.now()}`,
      callback:{auto:true,url:callback},cancel_url:cancel,
      synchronous_checks:true,retry_enabled:true,resume_enabled:true
    }),cache:"no-store"
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data?.id){
    const url=new URL("/age-check",origin);url.searchParams.set("returnTo",returnTo);url.searchParams.set("error","Age verification could not be started.");return NextResponse.redirect(url,303);
  }
  return NextResponse.redirect(`https://age.yoti.com?sessionId=${encodeURIComponent(data.id)}&sdkId=${encodeURIComponent(sdkId)}`,303);
}
