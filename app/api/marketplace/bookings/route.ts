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
    const supabase = getPublicSupabaseClient();
    const { data: machine, error: machineError } = await supabase
      .from("cqa_machines")
      .select("id,business_id,status")
      .eq("slug", payload.machineSlug)
      .eq("status", "live")
      .single();

    if (machineError || !machine) return NextResponse.json({ error: "This business machine is not available." }, { status: 404 });

    let offerId: string | null = null;
    if (payload.offerId !== "general") {
      const { data: offer } = await supabase
        .from("cqa_offers")
        .select("id")
        .eq("id", payload.offerId)
        .eq("machine_id", machine.id)
        .eq("active", true)
        .single();
      if (!offer) return NextResponse.json({ error: "This offer is not available." }, { status: 404 });
      offerId = offer.id;
    }

    const requestedAt = payload.requestedAt ? new Date(payload.requestedAt) : null;
    if (requestedAt && Number.isNaN(requestedAt.getTime())) return NextResponse.json({ error: "Invalid requested date/time." }, { status: 400 });

    const { error } = await supabase.from("cqa_bookings").insert({
      business_id: machine.business_id,
      machine_id: machine.id,
      offer_id: offerId,
      customer_name: payload.customerName.trim(),
      customer_email: payload.customerEmail.trim().toLowerCase(),
      customer_phone: payload.customerPhone?.trim() || null,
      requested_at: requestedAt?.toISOString() || null,
      notes: payload.notes?.trim() || null,
      status: "requested"
    });

    if (error) return NextResponse.json({ error: "The request could not be saved. Please try again." }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Invalid request." }, { status: 400 });
    return NextResponse.json({ error: "Unable to submit this request." }, { status: 500 });
  }
}
