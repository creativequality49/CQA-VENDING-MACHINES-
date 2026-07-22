import { NextRequest, NextResponse } from "next/server";
import {
  FANVUE_FLOW_COOKIE,
  FANVUE_SESSION_COOKIE,
  exchangeCode,
  seal,
  unseal,
} from "../../../../lib/fanvue-oauth";

export const runtime = "nodejs";

type FlowCookie = { state: string; verifier: string; createdAt: number };

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const providerError = request.nextUrl.searchParams.get("error_description") || request.nextUrl.searchParams.get("error");

  if (providerError) {
    return NextResponse.redirect(new URL(`/fanxfantasy?error=${encodeURIComponent(providerError)}`, baseUrl));
  }

  const flow = unseal<FlowCookie>(request.cookies.get(FANVUE_FLOW_COOKIE)?.value);
  if (!code || !state || !flow || flow.state !== state || Date.now() - flow.createdAt > 10 * 60 * 1000) {
    return NextResponse.redirect(new URL("/fanxfantasy?error=Fanvue%20login%20session%20expired", baseUrl));
  }

  try {
    const tokenSet = await exchangeCode(code, flow.verifier);
    const response = NextResponse.redirect(new URL("/fanxfantasy?connected=1", baseUrl));
    response.cookies.delete(FANVUE_FLOW_COOKIE);
    response.cookies.set(FANVUE_SESSION_COOKIE, seal(tokenSet), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fanvue connection failed";
    return NextResponse.redirect(new URL(`/fanxfantasy?error=${encodeURIComponent(message)}`, baseUrl));
  }
}
