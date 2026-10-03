import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCqaOwner } from "@/lib/cqa-owner-auth";
import { indexContextItem } from "@/lib/cqa-ai-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  businessId: z.string().uuid(),
  kind: z.enum(["note", "faq", "policy", "url", "file", "instruction"]).default("note"),
  title: z.string().min(2).max(200),
  content: z.string().min(2).max(30000),
  metadata: z.record(z.unknown()).optional()
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const { admin } = await requireCqaOwner(req, body.businessId);

    const { data: item, error } = await admin
      .from("cqa_context_items")
      .insert({
        business_id: body.businessId,
        kind: body.kind,
        title: body.title,
        content: body.content,
        metadata: body.metadata || {},
        active: true
      })
      .select("id,kind,title,content,active,created_at")
      .single();

    if (error || !item) throw new Error(error?.message || "Unable to store business knowledge.");

    let embedding: { id: string; model: string } | null = null;
    let embeddingError: string | null = null;
    try {
      embedding = await indexContextItem(body.businessId, item.id);
    } catch (indexError) {
      embeddingError = indexError instanceof Error ? indexError.message : "Embedding unavailable.";
    }

    return NextResponse.json(
      { ok: true, item, embedded: Boolean(embedding), embedding, embeddingError },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid knowledge item." },
        { status: 400 }
      );
    }
    const status =
      typeof error === "object" &&
      error &&
      "status" in error &&
      typeof (error as { status?: unknown }).status === "number"
        ? Number((error as { status: number }).status)
        : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to store business knowledge." },
      { status }
    );
  }
}
