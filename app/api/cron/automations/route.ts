import { NextResponse } from "next/server";
import { resumeDueAutomationRuns } from "@/lib/cqa-automation-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const querySecret = new URL(req.url).searchParams.get("secret") || "";
  const supplied = bearer || querySecret;
  if (!process.env.CRON_SECRET || supplied !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await resumeDueAutomationRuns(25);
    return NextResponse.json({ ok: true, processed: results.length, results });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Automation cron failed." }, { status: 500 });
  }
}
