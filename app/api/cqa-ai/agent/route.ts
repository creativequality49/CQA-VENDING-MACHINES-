import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCqaOwner } from "@/lib/cqa-owner-auth";
import { runCqaAgent } from "@/lib/cqa-ai-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  businessId: z.string().uuid(),
  agentKey: z.enum([
    "business_manager",
    "marketing",
    "product",
    "support",
    "accounts",
    "compliance",
    "builder"
  ]),
  task: z.string().min(2).max(8000),
  additionalContext: z.record(z.unknown()).optional()
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const { user } = await requireCqaOwner(req, body.businessId);

    const result = await runCqaAgent({
      businessId: body.businessId,
      userId: user.id,
      agentKey: body.agentKey,
      task: body.task,
      additionalContext: body.additionalContext,
      metadata: { source: "api" }
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid AI request." },
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
      { error: error instanceof Error ? error.message : "Unable to run CQA AI." },
      { status }
    );
  }
}
