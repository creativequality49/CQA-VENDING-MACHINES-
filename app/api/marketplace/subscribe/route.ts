import { NextResponse } from "next/server";
import { z } from "zod";
import { getPublicSupabaseClient } from "@/lib/cqa-marketplace";
import { getCqaSupabaseAdmin } from "@/lib/cqa-supabase-admin";
import { triggerBusinessAutomations } from "@/lib/cqa-automation-engine";

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
    const { data: machine, error: machineError } = await publicClient.from("cqa_machines").select("id,business_id,status").eq("slug", payload.machineSlug).eq("status", "live").single();
    if (machineError || !machine) return NextResponse.json({ error: "This business machine is not available." }, { status: 404 });

    const admin = getCqaSupabaseAdmin();
    const email = payload.email.trim().toLowerCase();
    const tags = Array.from(new Set([...(payload.tags || []), "subscriber"]));
    const { data: contact, error } = await admin.from("cqa_contacts").upsert({
      business_id: machine.business_id,
      email,
      name: payload.name?.trim() || null,
      status: "subscribed",
      tags,
      source: payload.source?.trim() || "machine_optin",
      metadata: { machine_id: machine.id },
      updated_at: new Date().toISOString()
    }, { onConflict: "business_id,email" }).select("id").single();
    if (error || !contact) return NextResponse.json({ error: "Unable to save this subscription." }, { status: 500 });

    void triggerBusinessAutomations(machine.business_id, "new_contact", { machineId: machine.id, source: payload.source || "machine_optin" }, contact.id).catch((automationError) => console.error("[automation] new_contact trigger failed", automationError));
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Invalid subscription." }, { status: 400 });
    return NextResponse.json({ error: "Unable to subscribe right now." }, { status: 500 });
  }
}
