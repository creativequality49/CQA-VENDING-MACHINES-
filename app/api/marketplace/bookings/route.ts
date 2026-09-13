import { NextResponse } from "next/server";
import { z } from "zod";
import { getPublicSupabaseClient } from "@/lib/cqa-marketplace";
import { getCqaSupabaseAdmin } from "@/lib/cqa-supabase-admin";
import { triggerBusinessAutomations } from "@/lib/cqa-automation-engine";

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
    const publicClient = getPublicSupabaseClient();
    const { data: machine, error: machineError } = await publicClient
      .from("cqa_machines")
      .select("id,business_id,status")
      .eq("slug", payload.machineSlug)
      .eq("status", "live")
      .single();

    if (machineError || !machine) return NextResponse.json({ error: "This business machine is not available." }, { status: 404 });

    let offerId: string | null = null;
    if (payload.offerId !== "general") {
      const { data: offer } = await publicClient
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

    const admin = getCqaSupabaseAdmin();
    const email = payload.customerEmail.trim().toLowerCase();
    const { data: booking, error } = await admin.from("cqa_bookings").insert({
      business_id: machine.business_id,
      machine_id: machine.id,
      offer_id: offerId,
      customer_name: payload.customerName.trim(),
      customer_email: email,
      customer_phone: payload.customerPhone?.trim() || null,
      requested_at: requestedAt?.toISOString() || null,
      notes: payload.notes?.trim() || null,
      status: "requested"
    }).select("id").single();

    if (error || !booking) return NextResponse.json({ error: "The request could not be saved. Please try again." }, { status: 500 });

    const { data: contact } = await admin.from("cqa_contacts").upsert({
      business_id: machine.business_id,
      email,
      name: payload.customerName.trim(),
      status: "subscribed",
      source: "booking",
      tags: ["booking-lead"],
      metadata: { latest_booking_id: booking.id, machine_id: machine.id },
      updated_at: new Date().toISOString()
    }, { onConflict: "business_id,email" }).select("id").single();

    void triggerBusinessAutomations(machine.business_id, "new_booking", {
      bookingId: booking.id,
      machineId: machine.id,
      offerId,
      requestedAt: requestedAt?.toISOString() || null,
      notes: payload.notes?.trim() || null
    }, contact?.id || null).catch((automationError) => console.error("[automation] new_booking trigger failed", automationError));

    return NextResponse.json({ ok: true, bookingId: booking.id });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Invalid request." }, { status: 400 });
    const message = error instanceof Error ? error.message : "Unable to submit this request.";
    if (message.includes("Supabase server key")) return NextResponse.json({ error: "Secure booking processing is temporarily unavailable." }, { status: 503 });
    return NextResponse.json({ error: "Unable to submit this request." }, { status: 500 });
  }
}
