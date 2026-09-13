import { NextResponse } from "next/server";
import { z } from "zod";
import { getPublicSupabaseClient } from "@/lib/cqa-marketplace";
import { getCqaSupabaseAdmin } from "@/lib/cqa-supabase-admin";
import { startAutomationRun } from "@/lib/cqa-automation-engine";

const schema = z.object({ automationId: z.string().uuid(), contactId: z.string().uuid().nullable().optional(), payload: z.record(z.unknown()).optional() });

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const { data: userData, error: userError } = await getPublicSupabaseClient().auth.getUser(token);
    if (userError || !userData.user) return NextResponse.json({ error: "Your login session is no longer valid." }, { status: 401 });

    const body = schema.parse(await req.json());
    const admin = getCqaSupabaseAdmin();
    const { data: automation } = await admin.from("cqa_automations").select("id,business_id,trigger_type").eq("id", body.automationId).maybeSingle();
    if (!automation) return NextResponse.json({ error: "Automation not found." }, { status: 404 });
    const { data: business } = await admin.from("cqa_businesses").select("id").eq("id", automation.business_id).eq("owner_id", userData.user.id).maybeSingle();
    if (!business) return NextResponse.json({ error: "You do not have access to this automation." }, { status: 403 });

    if (body.contactId) {
      const { data: contact } = await admin.from("cqa_contacts").select("id").eq("id", body.contactId).eq("business_id", automation.business_id).maybeSingle();
      if (!contact) return NextResponse.json({ error: "Contact does not belong to this business." }, { status: 400 });
    }

    const run = await startAutomationRun(automation.id, "manual", body.payload || { requestedBy: userData.user.id }, body.contactId || null);
    await admin.from("cqa_audit_logs").insert({ business_id: automation.business_id, actor_user_id: userData.user.id, action: "automation.run", entity_type: "automation", entity_id: automation.id, metadata: { run_id: run.id, status: run.status } });
    return NextResponse.json({ ok: true, run });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Invalid run request." }, { status: 400 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to run automation." }, { status: 500 });
  }
}
