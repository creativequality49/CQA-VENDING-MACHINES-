import { NextResponse } from "next/server";
import { z } from "zod";
import { getPublicSupabaseClient } from "@/lib/cqa-marketplace";

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
    const publicClient = getPublicSupabaseClient();

    const { error } = await publicClient.rpc("cqa_submit_sales_lead", {
      p_name: payload.name,
      p_email: payload.email.toLowerCase(),
      p_phone: payload.phone || "",
      p_business_name: payload.businessName || "",
      p_service: payload.service || "general",
      p_quoted_price: payload.price || "",
      p_message: payload.message
    });

    if (error) {
      if (error.message?.includes("too many enquiries")) {
        return NextResponse.json({ error: "Too many enquiries were submitted. Please try again later." }, { status: 429 });
      }
      throw error;
    }

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
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Check the enquiry details and try again." }, { status: 400 });
    }
    console.error("[cqa-contact] failed", error);
    return NextResponse.json({ error: "Your enquiry could not be saved. Please try again." }, { status: 500 });
  }
}
