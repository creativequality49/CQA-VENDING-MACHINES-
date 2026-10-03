import { NextResponse } from "next/server";
import {
  AI_MODEL_FAMILIES,
  PRODUCT_AI_STACK,
  buildAIExecutionPlan,
  type AIExecutionRequest,
} from "@/lib/ai/model-router";

export async function GET() {
  return NextResponse.json({
    ok: true,
    families: AI_MODEL_FAMILIES,
    stack: PRODUCT_AI_STACK,
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<AIExecutionRequest>;
    if (!body.task || typeof body.task !== "string") {
      return NextResponse.json({ error: "task is required" }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      plan: buildAIExecutionPlan(body as AIExecutionRequest),
    });
  } catch {
    return NextResponse.json({ error: "Invalid AI routing request" }, { status: 400 });
  }
}
