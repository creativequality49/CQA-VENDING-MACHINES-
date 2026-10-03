import { NextResponse } from "next/server";
import { z } from "zod";
import { getPublicSupabaseClient } from "@/lib/cqa-marketplace";

const schema = z.object({
  machineSlug: z.string().min(1).max(100),
  offerId: z.string().min(1).max(100),
  customerName: z.string().min(2).max(120),
  customerEmail: z.string().email().max(200),
  customerPhone: z.string().max(40).optional(),
  notes: z.string().min(2).max(4000).optional(),
  requestedAt: z.string().max(40).optional()
});

export async function POST(req: Request) {
  try {
    const payload = schema.parse(await req.json());
    const requestedAt = payload.requestedAt ? new Date(payload.requestedAt) : null;

    if (requestedAt && Number.isNaN(requestedAt.getTime())) {
      return NextResponse.json({ error: "Invalid requested date/time." }, { status: 400 });
    }

    const publicClient = getPublicSupabaseClient();
    const { data, error } = await publicClient.rpc("cqa_machine_booking", {
      p_machine_slug: payload.machineSlug,
      p_offer_id: payload.offerId === "general" ? null : payload.offerId,
      p_customer_name: payload.customerName.trim(),
      p_customer_email: payload.customerEmail.trim().toLowerCase(),
      p_customer_phone: payload.customerPhone?.trim() || null,
      p_notes: payload.notes?.trim() || null,
      p_requested_at: requestedAt?.toISOString() || null
    });

    if (error) {
      const message = error.message || "";
      if (message.includes("too many booking requests")) {
        return NextResponse.json({ error: "Too many requests were submitted. Please try again later." }, { status: 429 });
      }
      if (message.includes("machine unavailable") || message.includes("offer unavailable")) {
        return NextResponse.json({ error: "This booking option is not available." }, { status: 404 });
      }
      console.error("[cqa-booking] secure RPC failed", message);
      return NextResponse.json({ error: "The request could not be saved. Please try again." }, { status: 500 });
    }

    const row = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({ ok: true, bookingId: row?.booking_id || null });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid request." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to submit this request." }, { status: 500 });
  }
}
