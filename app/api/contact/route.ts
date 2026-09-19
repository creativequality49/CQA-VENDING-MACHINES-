import { NextResponse } from "next/server";
import { z } from "zod";
import { getCqaSupabaseAdmin } from "@/lib/cqa-supabase-admin";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(50).optional().default(""),
  businessName: z.string().trim().max(160).optional().default(""),
  service: z.string().trim().max(120).optional().default("general"),
  price: z.string().trim().max(40).optional().default(""),
  message: z.string().trim().min(10).max(3000)
});

export async function POST(req: Request) {
  try {
    const payload = schema.parse(await req.json());
    const admin = getCqaSupabaseAdmin();
    const { error } = await admin.from("cqa_sales_leads").insert({
      name: payload.name,
      email: payload.email.toLowerCase(),
      phone: payload.phone || null,
      business_name: payload.businessName || null,
      service: payload.service || "general",
      quoted_price: payload.price || null,
      message: payload.message,
      source: "website",
      status: "new",
      metadata: {
        user_agent: req.headers.get("user-agent") || null,
        referer: req.headers.get("referer") || null
      }
    });
    if (error) throw error;

    const webhookUrl = process.env.QUIZ_LEAD_WEBHOOK_URL;
    if (webhookUrl) {
      void fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, source: "cqa-contact", createdAt: new Date().toISOString() }),
        cache: "no-store"
      }).catch((webhookError) => console.error("[cqa-contact] optional CRM webhook failed", webhookError));
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Check the enquiry details and try again." }, { status: 400 });
    console.error("[cqa-contact] failed", error);
    return NextResponse.json({ error: "Your enquiry could not be saved. Please try again." }, { status: 500 });
  }
}
