import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const contentId = new URL(req.url).searchParams.get("contentId");
  if (!contentId) return NextResponse.json({ error: "Use /api/content/[id]/download with a contentId" }, { status: 400 });
  return NextResponse.redirect(new URL(`/api/content/${contentId}/download`, req.url));
}
