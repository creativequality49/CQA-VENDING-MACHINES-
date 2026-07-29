import { NextResponse } from "next/server";
import { releaseScheduledDrops } from "@/lib/drops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorised(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authorization = req.headers.get("authorization");
  if (authorization === `Bearer ${cronSecret}`) return true;

  // Retain query-secret compatibility for controlled manual runs.
  const { searchParams } = new URL(req.url);
  return searchParams.get("secret") === cronSecret;
}

export async function GET(req: Request) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const released = await releaseScheduledDrops(new Date());
    console.info("[cron] Scheduled drops processed", {
      released,
      at: new Date().toISOString()
    });

    return NextResponse.json({ ok: true, released });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown cron failure";
    console.error("[cron] Scheduled drop processing failed", { message });

    return NextResponse.json(
      { ok: false, error: "Scheduled drop processing failed" },
      { status: 500 }
    );
  }
}
