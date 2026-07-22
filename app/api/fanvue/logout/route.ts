import { NextRequest, NextResponse } from "next/server";
import { FANVUE_FLOW_COOKIE, FANVUE_SESSION_COOKIE } from "../../../../lib/fanvue-oauth";

export async function POST(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  const response = NextResponse.redirect(new URL("/fanxfantasy", baseUrl), 303);
  response.cookies.delete(FANVUE_FLOW_COOKIE);
  response.cookies.delete(FANVUE_SESSION_COOKIE);
  return response;
}
