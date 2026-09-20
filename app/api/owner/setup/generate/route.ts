import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCqaOwner } from "@/lib/cqa-owner-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({ businessId: z.string().uuid() });

const generatedSchema = z.object({
  machineTitle: z.string().min(2).max(120),
  subtitle: z.string().min(2).max(280),
  theme: z.enum(["pink","cyan","gold","violet"]),
  storefrontHeadline: z.string().min(2).max(120),
  storefrontSubheadline: z.string().min(2).max(220),
  assistantBrief: z.string().max(1600).optional().default(""),
  offers: z.array(z.object({
    name: z.string().min(2).max(120),
    description: z.string().max(1200).optional().default(""),
    offerType: z.enum(["service","booking","physical_product","digital_product","subscription","quote","consultation"]),
    priceCents: z.number().int().nonnegative().nullable(),
    fulfillmentType: z.enum(["none","digital","shipping","booking","service","subscription","external"]),
    shippingRequired: z.boolean().default(false)
  })).max(30),
  integrationRecommendations: z.array(z.object({
    provider: z.enum(["shopify","printify","instagram","facebook","fanvue","xero","quickbooks","bank_feed","custom_api"]),
    reason: z.string().max(300)
  })).max(12).optional().default([])
});

function extractJson(text: string) {
  const trimmed = text.trim().replace(/^\`\`\`json\s*/i, "").replace(/\`\`\`$/i, "").trim();
  return JSON.parse(trimmed);
}

function fallbackDraft(business: { name: string; category: string; description: string | null }, setup: Record<string, unknown>) {
  const fulfillment = Array.isArray(setup.fulfillment_model) ? setup.fulfillment_model as string[] : [];
  const physical = fulfillment.some((x) => /physical|shipping|product/i.test(x));
  const digital = fulfillment.some((x) => /digital/i.test(x));
  const service = fulfillment.some((x) => /service|booking/i.test(x));
  const offerType = physical ? "physical_product" : digital ? "digital_product" : service ? "service" : "quote";
  const fulfillmentType = physical ? "shipping" : digital ? "digital" : service ? "service" : "none";
  return {
    machineTitle: `${business.name} Machine`,
    subtitle: business.description || `Explore ${business.name} through its CQA digital vending machine.`,
    theme: business.category.toLowerCase().includes("beauty") || business.category.toLowerCase().includes("fashion") ? "pink" as const
      : business.category.toLowerCase().includes("fitness") ? "gold" as const
      : "cyan" as const,
    storefrontHeadline: business.name,
    storefrontSubheadline: business.description || "Products, services and enquiries in one machine.",
    assistantBrief: "Answer using only the business information supplied by the owner. Escalate uncertain or sensitive requests to the owner.",
    offers: [{
      name: `Enquire with ${business.name}`,
      description: business.description || "Send an enquiry to this business.",
      offerType: offerType as "service"|"physical_product"|"digital_product"|"quote",
      priceCents: null,
      fulfillmentType: fulfillmentType as "shipping"|"digital"|"service"|"none",
      shippingRequired: physical
    }],
    integrationRecommendations: [] as Array<{ provider: "shopify"|"printify"|"instagram"|"facebook"|"fanvue"|"xero"|"quickbooks"|"bank_feed"|"custom_api"; reason: string }>
  };
}

export async function POST(req: Request) {
  try {
    const { businessId } = requestSchema.parse(await req.json());
    const { business, admin } = await requireCqaOwner(req, businessId);

    const [{ data: billing }, { data: setup }, { data: machine }] = await Promise.all([
      admin.from("cqa_plan_subscriptions").select("status").eq("business_id", business.id).maybeSingle(),
      admin.from("cqa_machine_setup_profiles").select("*").eq("business_id", business.id).maybeSingle(),
      admin.from("cqa_machines").select("id,slug").eq("business_id", business.id).maybeSingle()
    ]);

    if (!billing || !["active","trialing"].includes(billing.status)) {
      return NextResponse.json({ error: "Activate the CQA machine subscription before generating the build." }, { status: 402 });
    }
    if (!setup) return NextResponse.json({ error: "Complete and save the setup questionnaire first." }, { status: 409 });
    if (!machine) return NextResponse.json({ error: "Machine shell not found." }, { status: 404 });
    if (business.plan === "starter") {
      return NextResponse.json({
        error: "Starter includes the guided shell. Automatic AI build-and-install is available on Pro and Elite.",
        upgradeRequired: true
      }, { status: 403 });
    }

    const apiKey = process.env.CQA_CHAT_API_KEY || process.env.OPENAI_API_KEY;
    const apiUrl = process.env.CQA_CHAT_API_URL || "https://api.openai.com/v1/chat/completions";
    const model = process.env.CQA_CHAT_MODEL || "gpt-4.1-mini";
    let draft = fallbackDraft(business, setup as Record<string, unknown>);
    let aiUsed = false;

    if (apiKey) {
      const maxOffers = business.plan === "elite" ? 30 : 12;
      const system = `You are the CQA Machine Builder. Convert an Australian business owner's supplied questionnaire into a draft digital vending machine. Never invent an ABN, legal status, shipping promise, stock quantity, product certification, price, social handle, or integration credential. Only create sellable offers that are directly supported by the owner's answers. If a price was not supplied, use null. Return strict JSON only.`;
      const user = JSON.stringify({
        task: "Build the storefront configuration and offers.",
        plan: business.plan,
        maxOffers,
        lockedTemplate: "activewear_master_v1",
        business,
        setup
      });

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          response_format: { type: "json_object" },
          temperature: 0.35,
          max_tokens: 2400,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user.slice(0, 18000) }
          ]
        }),
        cache: "no-store"
      });
      const raw = await response.json().catch(() => ({}));
      if (response.ok) {
        const text = raw?.choices?.[0]?.message?.content || raw?.output_text || "";
        try {
          draft = generatedSchema.parse(extractJson(text));
          aiUsed = true;
        } catch (parseError) {
          console.error("[owner/setup/generate] invalid AI JSON", parseError);
        }
      } else {
        console.error("[owner/setup/generate] AI provider failed", response.status);
      }
    }

    const offerLimit = business.plan === "elite" ? 30 : 12;
    const offers = draft.offers.slice(0, offerLimit);
    const now = new Date().toISOString();
    const customization = {
      storefrontHeadline: draft.storefrontHeadline,
      storefrontSubheadline: draft.storefrontSubheadline,
      assistantBrief: draft.assistantBrief,
      primaryColor: setup.primary_color || null,
      secondaryColor: setup.secondary_color || null,
      brandDirection: setup.brand_direction || null,
      designNotes: setup.design_notes || null
    };

    const { error: machineError } = await admin.from("cqa_machines").update({
      title: draft.machineTitle,
      subtitle: draft.subtitle,
      theme: draft.theme,
      template_key: "activewear_master_v1",
      template_locked: true,
      customization,
      updated_at: now
    }).eq("id", machine.id);
    if (machineError) throw machineError;

    const { error: deleteError } = await admin
      .from("cqa_offers")
      .delete()
      .eq("business_id", business.id)
      .eq("source_provider", "cqa_ai");
    if (deleteError) throw deleteError;

    if (offers.length) {
      const rows = offers.map((offer, index) => ({
        business_id: business.id,
        machine_id: machine.id,
        name: offer.name,
        description: offer.description || null,
        offer_type: offer.offerType,
        price_cents: offer.priceCents,
        currency: "aud",
        active: false,
        sort_order: index,
        source_provider: "cqa_ai",
        fulfillment_type: offer.fulfillmentType,
        shipping_required: offer.shippingRequired,
        metadata: { generated: true, ai_used: aiUsed, generated_at: now }
      }));
      const { error: offerError } = await admin.from("cqa_offers").insert(rows);
      if (offerError) throw offerError;
    }

    for (const recommendation of draft.integrationRecommendations || []) {
      await admin.from("cqa_business_connections").upsert({
        business_id: business.id,
        provider: recommendation.provider,
        label: recommendation.provider.replaceAll("_", " ").replace(/\b\w/g, (m: string) => m.toUpperCase()),
        status: "disconnected",
        capabilities: [],
        metadata: { recommended: true, reason: recommendation.reason },
        updated_at: now
      }, { onConflict: "business_id,provider" });
    }

    const { error: setupError } = await admin.from("cqa_machine_setup_profiles").update({
      setup_status: business.plan === "elite" ? "review" : "generated",
      ai_draft: draft,
      generated_at: now,
      updated_at: now
    }).eq("business_id", business.id);
    if (setupError) throw setupError;

    return NextResponse.json({
      ok: true,
      aiUsed,
      mode: business.plan === "elite" ? "done_for_you" : "assisted",
      draft,
      installedOffers: offers.length,
      message: aiUsed
        ? "CQA built and installed a draft machine from the questionnaire."
        : "The machine shell was built, but the AI provider was unavailable. Review the fallback draft before publishing."
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid machine build request." }, { status: 400 });
    const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : 500;
    console.error("[owner/setup/generate] failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to generate machine build." }, { status });
  }
}
