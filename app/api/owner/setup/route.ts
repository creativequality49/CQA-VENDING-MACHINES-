import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCqaOwner } from "@/lib/cqa-owner-auth";

const saveSchema = z.object({
  businessId: z.string().uuid(),
  setupMode: z.enum(["shell","guided","assisted","done_for_you"]).optional(),
  abn: z.string().trim().max(32).optional().nullable(),
  legalName: z.string().trim().max(180).optional().nullable(),
  businessStructure: z.string().trim().max(80).optional().nullable(),
  salesModel: z.array(z.string().trim().max(60)).max(12).optional(),
  fulfillmentModel: z.array(z.string().trim().max(60)).max(12).optional(),
  shippingRegions: z.array(z.string().trim().max(80)).max(20).optional(),
  audience: z.string().trim().max(1200).optional().nullable(),
  brandDirection: z.string().trim().max(1200).optional().nullable(),
  primaryColor: z.string().trim().max(32).optional().nullable(),
  secondaryColor: z.string().trim().max(32).optional().nullable(),
  designNotes: z.string().trim().max(3000).optional().nullable(),
  businessSummary: z.string().trim().max(3000).optional().nullable(),
  answers: z.record(z.string(), z.unknown()).optional(),
  completedSteps: z.array(z.string().trim().max(80)).max(50).optional()
});

function allowedMode(plan: string, requested?: string) {
  if (plan === "elite") return requested === "done_for_you" ? "done_for_you" : requested === "assisted" ? "assisted" : "guided";
  if (plan === "pro") return requested === "assisted" ? "assisted" : "guided";
  return requested === "shell" ? "shell" : "guided";
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const businessId = url.searchParams.get("businessId") || undefined;
    const { business, admin } = await requireCqaOwner(req, businessId);

    const [{ data: setup }, { data: machine }, { data: assets }, { data: connections }] = await Promise.all([
      admin.from("cqa_machine_setup_profiles").select("*").eq("business_id", business.id).maybeSingle(),
      admin.from("cqa_machines").select("id,slug,title,subtitle,theme,status,template_key,template_locked,layout_version,hero_image_url,customization").eq("business_id", business.id).maybeSingle(),
      admin.from("cqa_machine_assets").select("id,kind,public_url,file_name,mime_type,size_bytes,alt_text,sort_order,created_at").eq("business_id", business.id).order("sort_order"),
      admin.from("cqa_business_connections").select("id,provider,label,status,capabilities,metadata,updated_at").eq("business_id", business.id).order("provider")
    ]);

    return NextResponse.json({ business, setup, machine, assets: assets || [], connections: connections || [] });
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load machine setup." }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const payload = saveSchema.parse(await req.json());
    const { business, admin } = await requireCqaOwner(req, payload.businessId);
    const setupMode = allowedMode(business.plan, payload.setupMode);

    const row = {
      business_id: business.id,
      setup_mode: setupMode,
      setup_status: "in_progress",
      abn: payload.abn || null,
      legal_name: payload.legalName || null,
      business_structure: payload.businessStructure || null,
      sales_model: payload.salesModel || [],
      fulfillment_model: payload.fulfillmentModel || [],
      shipping_regions: payload.shippingRegions || [],
      audience: payload.audience || null,
      brand_direction: payload.brandDirection || null,
      primary_color: payload.primaryColor || null,
      secondary_color: payload.secondaryColor || null,
      design_notes: payload.designNotes || null,
      business_summary: payload.businessSummary || null,
      answers: payload.answers || {},
      completed_steps: payload.completedSteps || [],
      updated_at: new Date().toISOString()
    };

    const { data, error } = await admin
      .from("cqa_machine_setup_profiles")
      .upsert(row, { onConflict: "business_id" })
      .select("*")
      .single();
    if (error) throw error;

    const customization = {
      primaryColor: payload.primaryColor || null,
      secondaryColor: payload.secondaryColor || null,
      brandDirection: payload.brandDirection || null,
      designNotes: payload.designNotes || null
    };
    await admin.from("cqa_machines").update({ customization, updated_at: new Date().toISOString() }).eq("business_id", business.id);

    return NextResponse.json({ ok: true, setup: data });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Check the setup answers and try again." }, { status: 400 });
    const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : 500;
    console.error("[owner/setup] save failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save machine setup." }, { status });
  }
}
