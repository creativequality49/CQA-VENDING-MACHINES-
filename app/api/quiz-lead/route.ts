import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    const lead = {
      email,
      readiness: Number(body.readiness) || 0,
      monthlyLoss: Number(body.monthlyLoss) || 0,
      yearlyLoss: Number(body.yearlyLoss) || 0,
      painScore: Number(body.painScore) || 0,
      hoursLost: Number(body.hoursLost) || 0,
      source: "ai-readiness-quiz",
      createdAt: new Date().toISOString(),
    };

    const webhookUrl = process.env.QUIZ_LEAD_WEBHOOK_URL;

    if (webhookUrl) {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead),
        cache: "no-store",
      });

      if (!response.ok) {
        console.error("Quiz lead webhook failed", response.status, await response.text());
        return NextResponse.json({ error: "Lead service unavailable" }, { status: 502 });
      }
    } else {
      console.info("Quiz lead captured without external webhook", lead);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Quiz lead capture error", error);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
