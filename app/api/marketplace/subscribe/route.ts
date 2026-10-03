import { NextResponse } from "next/server";
import { z } from "zod";
import { getPublicSupabaseClient } from "@/lib/cqa-marketplace";

const schema = z.object({
  machineSlug: z.string().min(1).max(100),
  email: z.string().email().max(200),
  name: z.string().max(120).optional(),
  tags: z.array(z.string().min(1).max(40)).max(10).optional(),
  source: z.string().max(80).optional()
});

export async function POST(req: Request) {
  try {
    const payload = schema.parse(await req.json());
    const publicClient = getPublicSupabaseClient();

    const { error } = await publicClient.rpc("cqa_machine_subscribe", {
      p_machine_slug: payload.machineSlug,
      p_email: payload.email.trim().toLowerCase(),
      p_name: payload.name?.trim() || null,
      p_source: payload.source?.trim() || "machine_optin",
      p_tags: payload.tags || []
    });

    if (error) {
      if (error.message?.includes("machine unavailable")) {
        return NextResponse.json({ error: "This business machine is not available." }, { status: 404 });
      }
      console.error("[cqa-subscribe] secure RPC failed", error.message);
      return NextResponse.json({ error: "Unable to save this subscription." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid subscription." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to subscribe right now." }, { status: 500 });
  }
}
