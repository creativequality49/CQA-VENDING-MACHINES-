import crypto from "node:crypto";
import { NextResponse } from "next/server";
import {
  FANVUE_FLOW_COOKIE,
  createAuthorizeUrl,
  generatePkce,
  seal,
} from "../../../../lib/fanvue-oauth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const state = crypto.randomBytes(24).toString("base64url");
    const { verifier, challenge } = generatePkce();
    const response = NextResponse.redirect(createAuthorizeUrl(state, challenge));
    response.cookies.set(FANVUE_FLOW_COOKIE, seal({ state, verifier, createdAt: Date.now() }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fanvue login could not start";
    return NextResponse.redirect(new URL(`/fanxfantasy?error=${encodeURIComponent(message)}`, process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"));
  }
}
