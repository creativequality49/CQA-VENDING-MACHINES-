import { NextResponse } from "next/server";
import { releaseScheduledDrops } from "@/lib/drops";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const released = releaseScheduledDrops(new Date());
  console.log("[cron] Released drops", { released, at: new Date().toISOString() });

  return NextResponse.json({ ok: true, released });
}
