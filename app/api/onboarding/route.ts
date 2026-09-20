import { NextResponse } from "next/server";
import { z } from "zod";
import { getPublicSupabaseClient } from "@/lib/cqa-marketplace";
import { getCqaSupabaseAdmin } from "@/lib/cqa-supabase-admin";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(80),
  description: z.string().trim().min(10).max(2000),
  location: z.string().trim().min(2).max(160),
  phone: z.string().trim().max(50).optional().default(""),
  businessEmail: z.string().email().max(200),
  plan: z.enum(["starter", "pro", "elite"])
});

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64);
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const payload = schema.parse(await req.json());
    const authClient = getPublicSupabaseClient();
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    const user = userData.user;
    if (userError || !user) return NextResponse.json({ error: "Your login session is no longer valid." }, { status: 401 });

    const admin = getCqaSupabaseAdmin();
    const { data: existing } = await admin.from("cqa_businesses").select("id").eq("owner_id", user.id).limit(1);
    if (existing?.length) return NextResponse.json({ businessId: existing[0].id, existing: true });

    const baseSlug = slugify(payload.name);
    if (!baseSlug) return NextResponse.json({ error: "Enter a valid business name." }, { status: 400 });

    let business: { id: string } | null = null;
    for (let attempt = 0; attempt < 4 && !business; attempt += 1) {
      const suffix = attempt === 0 ? "" : `-${Math.floor(1000 + Math.random() * 9000)}`;
      const { data, error } = await admin.from("cqa_businesses").insert({
        owner_id: user.id,
        name: payload.name,
        slug: `${baseSlug}${suffix}`,
        category: payload.category,
        description: payload.description,
        location_text: payload.location,
        phone: payload.phone || null,
        email: payload.businessEmail,
        plan: payload.plan,
        status: "review"
      }).select("id").single();

      if (!error && data) business = data as { id: string };
      else if (error?.code !== "23505") throw error;
    }
    if (!business) return NextResponse.json({ error: "That business name is already in use. Adjust it and try again." }, { status: 409 });

    const machineSlug = `${baseSlug}-machine-${business.id.slice(0, 6)}`;
    const { error: machineError } = await admin.from("cqa_machines").insert({
      business_id: business.id,
      slug: machineSlug,
      title: `${payload.name} Machine`,
      subtitle: payload.description || `The official ${payload.name} digital vending machine.`,
      theme: payload.plan === "elite" ? "gold" : payload.plan === "pro" ? "cyan" : "pink",
      status: "review",
      assistant_enabled: true
    });

    if (machineError) {
      await admin.from("cqa_businesses").delete().eq("id", business.id);
      throw machineError;
    }

    return NextResponse.json({ businessId: business.id, existing: false });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Check the business details and try again." }, { status: 400 });
    console.error("[cqa-onboarding] failed", error);
    return NextResponse.json({ error: "The business workspace could not be created." }, { status: 500 });
  }
}
