import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreatorMode = "chat" | "image" | "video";

type CreatorRequest = {
  mode?: CreatorMode;
  prompt?: string;
  message?: string;
  character?: string;
  adultConfirmed?: boolean;
  conversation?: Array<{ role: "user" | "assistant"; content: string }>;
};

const SCARLETT_PERSONA = `You are Scarlett May, a fictional AI creator operated by Creative Quality Australia. You are warm, confident, playful and lightly flirty. Never claim to be a human. Never pressure, guilt, threaten or manipulate a customer into spending money. Do not interact sexually with anyone under 18 or anyone whose age is uncertain. Keep replies concise and conversational. When appropriate, naturally mention available premium content or subscriptions without being pushy.`;

function cleanConversation(value: CreatorRequest["conversation"]) {
  return (value ?? [])
    .filter((item) => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string")
    .slice(-12)
    .map((item) => ({ role: item.role, content: item.content.slice(0, 4000) }));
}

async function runChat(body: CreatorRequest) {
  const message = (body.message ?? body.prompt ?? "").trim();
  if (!message) return NextResponse.json({ error: "Message is required." }, { status: 400 });

  const apiKey = process.env.CQA_CHAT_API_KEY || process.env.OPENAI_API_KEY;
  const apiUrl = process.env.CQA_CHAT_API_URL || "https://api.openai.com/v1/chat/completions";
  const model = process.env.CQA_CHAT_MODEL || "gpt-4.1-mini";

  if (!apiKey) {
    return NextResponse.json(
      {
        error: "Chat provider is not configured.",
        missing: ["CQA_CHAT_API_KEY (or OPENAI_API_KEY)"],
      },
      { status: 503 },
    );
  }

  const conversation = cleanConversation(body.conversation);
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SCARLETT_PERSONA },
        ...conversation,
        { role: "user", content: message.slice(0, 4000) },
      ],
      temperature: 0.9,
      max_tokens: 320,
    }),
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return NextResponse.json(
      { error: "Chat provider request failed.", providerStatus: response.status, details: data },
      { status: 502 },
    );
  }

  const text =
    data?.choices?.[0]?.message?.content ||
    data?.output_text ||
    data?.output?.[0]?.content?.[0]?.text ||
    "";

  return NextResponse.json({ ok: true, mode: "chat", text, raw: text ? undefined : data });
}

async function runMedia(body: CreatorRequest, mode: "image" | "video") {
  const prompt = (body.prompt ?? "").trim();
  if (!prompt) return NextResponse.json({ error: "Prompt is required." }, { status: 400 });

  const apiUrl = process.env.CQA_MEDIA_API_URL;
  const apiKey = process.env.CQA_MEDIA_API_KEY;
  const model = mode === "image" ? process.env.CQA_IMAGE_MODEL : process.env.CQA_VIDEO_MODEL;

  if (!apiUrl || !apiKey || !model) {
    return NextResponse.json(
      {
        error: `${mode === "image" ? "Image" : "Video"} provider is not configured.`,
        missing: ["CQA_MEDIA_API_URL", "CQA_MEDIA_API_KEY", mode === "image" ? "CQA_IMAGE_MODEL" : "CQA_VIDEO_MODEL"],
      },
      { status: 503 },
    );
  }

  if (body.adultConfirmed !== true && /\b(nsfw|nude|naked|explicit|sexual|sex)\b/i.test(prompt)) {
    return NextResponse.json({ error: "18+ confirmation is required for adult generation requests." }, { status: 403 });
  }

  const character = (body.character || "Scarlett May").slice(0, 120);
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mode,
      model,
      prompt,
      character,
      adult_confirmed: body.adultConfirmed === true,
      metadata: { app: "CQA Creator Studio", character },
    }),
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return NextResponse.json(
      { error: `${mode} provider request failed.`, providerStatus: response.status, details: data },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, mode, result: data });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    configured: {
      chat: Boolean(process.env.CQA_CHAT_API_KEY || process.env.OPENAI_API_KEY),
      image: Boolean(process.env.CQA_MEDIA_API_URL && process.env.CQA_MEDIA_API_KEY && process.env.CQA_IMAGE_MODEL),
      video: Boolean(process.env.CQA_MEDIA_API_URL && process.env.CQA_MEDIA_API_KEY && process.env.CQA_VIDEO_MODEL),
      fanvueMessaging: Boolean(process.env.FANVUE_API_KEY),
    },
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as CreatorRequest;
  if (body.mode === "chat") return runChat(body);
  if (body.mode === "image" || body.mode === "video") return runMedia(body, body.mode);
  return NextResponse.json({ error: "mode must be chat, image or video." }, { status: 400 });
}
