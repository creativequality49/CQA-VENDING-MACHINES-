import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedSupabaseClient, getPublicSupabaseClient } from "@/lib/cqa-marketplace";

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
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const payload = schema.parse(await req.json());
    const publicClient = getPublicSupabaseClient();
    const { data: userData, error: userError } = await publicClient.auth.getUser(token);
    const user = userData.user;
    if (userError || !user) {
      return NextResponse.json({ error: "Your login session is no longer valid." }, { status: 401 });
    }

    const slugBase = slugify(payload.name);
    if (!slugBase) return NextResponse.json({ error: "Enter a valid business name." }, { status: 400 });

    const ownerClient = getAuthenticatedSupabaseClient(token);
    const { data, error } = await ownerClient.rpc("cqa_create_business_workspace", {
      p_name: payload.name,
      p_slug_base: slugBase,
      p_category: payload.category,
      p_description: payload.description,
      p_location: payload.location,
      p_phone: payload.phone || "",
      p_email: payload.businessEmail,
      p_plan: payload.plan
    });

    if (error) {
      console.error("[cqa-onboarding] workspace RPC failed", error.message);
      return NextResponse.json({ error: "The business workspace could not be created." }, { status: 500 });
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.business_id) {
      return NextResponse.json({ error: "The business workspace could not be created." }, { status: 500 });
    }

    return NextResponse.json({ businessId: row.business_id, existing: Boolean(row.existing) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Check the business details and try again." }, { status: 400 });
    }
    console.error("[cqa-onboarding] failed", error);
    return NextResponse.json({ error: "The business workspace could not be created." }, { status: 500 });
  }
}
