import { NextResponse } from "next/server";
import { z } from "zod";
import { getPublicSupabaseClient } from "@/lib/cqa-marketplace";
import { getCqaSupabaseAdmin } from "@/lib/cqa-supabase-admin";
import { CQA_AUTOMATION_TEMPLATES, createAutomationFromTemplate } from "@/lib/cqa-automation-engine";

const createSchema = z.object({ businessId: z.string().uuid(), templateKey: z.string().min(1).max(80), name: z.string().min(2).max(120).optional() });
const statusSchema = z.object({ automationId: z.string().uuid(), status: z.enum(["active", "paused", "draft"]) });

async function getUser(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return null;
  const { data, error } = await getPublicSupabaseClient().auth.getUser(token);
  return error ? null : data.user;
}

async function ownsBusiness(userId: string, businessId: string) {
  const admin = getCqaSupabaseAdmin();
  const { data } = await admin.from("cqa_businesses").select("id").eq("id", businessId).eq("owner_id", userId).maybeSingle();
  return Boolean(data);
}

export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const admin = getCqaSupabaseAdmin();
    const { data: businesses } = await admin.from("cqa_businesses").select("id,name").eq("owner_id", user.id).order("created_at").limit(20);
    const businessIds = (businesses || []).map((item) => item.id);
    if (!businessIds.length) return NextResponse.json({ templates: CQA_AUTOMATION_TEMPLATES, businesses: [], automations: [], runs: [], contacts: [], connections: [], context: [] });
    const [{ data: automations }, { data: runs }, { data: contacts }, { data: connections }, { data: context }] = await Promise.all([
      admin.from("cqa_automations").select("id,business_id,name,description,trigger_type,status,template_key,created_at,cqa_automation_steps(id,step_order,step_type,name,enabled,config)").in("business_id", businessIds).order("created_at", { ascending: false }),
      admin.from("cqa_automation_runs").select("id,business_id,automation_id,status,trigger_type,current_step_order,next_run_at,error_text,created_at,completed_at,output").in("business_id", businessIds).order("created_at", { ascending: false }).limit(40),
      admin.from("cqa_contacts").select("id,business_id,email,name,status,tags,source,created_at").in("business_id", businessIds).order("created_at", { ascending: false }).limit(100),
      admin.from("cqa_business_connections").select("id,business_id,provider,label,status,capabilities,metadata,updated_at").in("business_id", businessIds).order("provider"),
      admin.from("cqa_context_items").select("id,business_id,kind,title,content,active,updated_at").in("business_id", businessIds).order("updated_at", { ascending: false }).limit(100)
    ]);
    return NextResponse.json({ templates: CQA_AUTOMATION_TEMPLATES, businesses: businesses || [], automations: automations || [], runs: runs || [], contacts: contacts || [], connections: connections || [], context: context || [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load CQA automations." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const body = createSchema.parse(await req.json());
    if (!(await ownsBusiness(user.id, body.businessId))) return NextResponse.json({ error: "Business not found or not owned by this account." }, { status: 403 });
    const automation = await createAutomationFromTemplate(body.businessId, user.id, body.templateKey, body.name);
    const admin = getCqaSupabaseAdmin();
    await admin.from("cqa_audit_logs").insert({ business_id: body.businessId, actor_user_id: user.id, action: "automation.created", entity_type: "automation", entity_id: automation.id, metadata: { template_key: body.templateKey } });
    return NextResponse.json({ ok: true, automation }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Invalid automation request." }, { status: 400 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create automation." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const body = statusSchema.parse(await req.json());
    const admin = getCqaSupabaseAdmin();
    const { data: automation } = await admin.from("cqa_automations").select("id,business_id").eq("id", body.automationId).maybeSingle();
    if (!automation || !(await ownsBusiness(user.id, automation.business_id))) return NextResponse.json({ error: "Automation not found or not owned by this account." }, { status: 403 });
    const { error } = await admin.from("cqa_automations").update({ status: body.status, updated_at: new Date().toISOString() }).eq("id", body.automationId);
    if (error) throw new Error(error.message);
    await admin.from("cqa_audit_logs").insert({ business_id: automation.business_id, actor_user_id: user.id, action: `automation.${body.status}`, entity_type: "automation", entity_id: body.automationId, metadata: {} });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Invalid status request." }, { status: 400 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update automation." }, { status: 500 });
  }
}
