import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const token = process.env.VERCEL_OIDC_TOKEN;
  if (!token) {
    return NextResponse.json({ ok: false, oidc: false, error: "VERCEL_OIDC_TOKEN is unavailable." }, { status: 503 });
  }

  const response = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "openai/gpt-5.6-sol",
      messages: [
        { role: "system", content: "Return valid JSON only." },
        { role: "user", content: "Return exactly {\"ok\":true}." }
      ],
      response_format: { type: "json_object" },
      max_tokens: 24
    }),
    cache: "no-store"
  });

  const data = await response.json().catch(() => ({}));
  return NextResponse.json({
    ok: response.ok,
    oidc: true,
    gatewayStatus: response.status,
    model: "openai/gpt-5.6-sol",
    output: data?.choices?.[0]?.message?.content || null,
    error: response.ok ? null : data?.error?.message || "AI Gateway request failed."
  }, { status: response.ok ? 200 : 502 });
}
