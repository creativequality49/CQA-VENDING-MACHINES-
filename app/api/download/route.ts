import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const contentId = new URL(req.url).searchParams.get("contentId");
  if (!contentId) return NextResponse.json({ error: "contentId is required" }, { status: 400 });
  return NextResponse.redirect(new URL(`/api/content/${contentId}/download`, req.url));
}
