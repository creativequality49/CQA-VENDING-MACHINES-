import { NextRequest, NextResponse } from "next/server";
import { AGE_COOKIE, createAgeToken } from "../../../../lib/age-assurance";

export const runtime="nodejs";

export async function GET(request:NextRequest){
  const apiKey=process.env.YOTI_AGE_API_KEY;
  const sdkId=process.env.YOTI_SDK_ID;
  const sessionId=request.nextUrl.searchParams.get("sessionId");
  const requested=request.nextUrl.searchParams.get("returnTo")||"/fanxfantasy";
  const returnTo=requested.startsWith("/")?requested:"/fanxfantasy";
  if(!apiKey||!sdkId||!sessionId){
    const u=new URL("/age-check",request.url);u.searchParams.set("returnTo",returnTo);u.searchParams.set("error","Age verification result was incomplete.");return NextResponse.redirect(u);
  }
  const r=await fetch(`https://age.yoti.com/api/v1/sessions/${encodeURIComponent(sessionId)}/result`,{headers:{Authorization:`Bearer ${apiKey}`,"Yoti-Sdk-Id":sdkId,"Content-Type":"application/json"},cache:"no-store"});
  const data=await r.json().catch(()=>({}));
  if(!r.ok||data?.status!=="COMPLETE"){
    const u=new URL("/age-check",request.url);u.searchParams.set("returnTo",returnTo);u.searchParams.set("error",data?.status==="FAIL"?"Age assurance did not confirm access eligibility.":"Age verification has not completed successfully.");return NextResponse.redirect(u);
  }
  const response=NextResponse.redirect(new URL(returnTo,request.url));
  response.cookies.set(AGE_COOKIE,createAgeToken(),{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:60*60*24*30});
  return response;
}
