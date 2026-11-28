import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCqaOwner } from "@/lib/cqa-owner-auth";
import { runCqaAgent, type CqaAgentKey } from "@/lib/cqa-ai-core";
import { canUseCqaWorker } from "@/lib/cqa-worker-access";

// Role workflows inspired by the Agency Agents roster (msitarzewski/agency-agents).
const roles = {
  receptionist: {
    agent: "support",
    instruction: [
      "Draft a brief, empathetic reply that answers the enquiry using verified FAQs or policies.",
      "Ask one focused question if a detail is missing. For booking requests, summarise the requested service and preferred time for the owner to verify before confirming.",
      "For refunds, payment disputes, safety issues, legal questions or unclear policies, provide an owner handoff with the issue and the decision needed."
    ].join("\n")
  },
  sales: {
    agent: "product",
    instruction: [
      "Identify the lead's need, timing and constraints using the information provided.",
      "Recommend the best fitting existing offer and explain the fit using verified benefits. If the fit is unclear, ask one qualification question before making a recommendation.",
      "Draft a concise follow-up for owner review with one clear next step. Use only supplied prices, discounts and availability."
    ].join("\n")
  },
  marketing: {
    agent: "marketing",
    instruction: [
      "Match the draft to the requested channel, audience and stored brand voice.",
      "Use a clear hook, a verified customer benefit and a single call to action. Flag claims or offer details that need evidence before use.",
      "Return copy ready for owner review."
    ].join("\n")
  }
} satisfies Record<string, { agent: CqaAgentKey; instruction: string }>;
export async function POST(req: Request) {
  try {
    const input = z.object({ workerId: z.enum(["receptionist", "sales", "marketing"]), task: z.string().trim().min(2).max(4000) }).parse(await req.json());
    const { business, user, admin } = await requireCqaOwner(req);
    const [plan, worker] = await Promise.all([
      admin.from("cqa_plan_subscriptions").select("plan,status").eq("business_id", business.id).maybeSingle(),
      admin.from("cqa_worker_subscriptions").select("status").eq("business_id", business.id).eq("worker_id", input.workerId).maybeSingle()
    ]);
    if (plan.error) throw plan.error;
    if (worker.error) throw worker.error;
    if (!canUseCqaWorker(plan.data?.plan, plan.data?.status, input.workerId, worker.data?.status)) return NextResponse.json({ error: "Activate Pro or Enterprise, or add a worker subscription to an active Starter plan." }, { status: 403 });
    const role = roles[input.workerId];
    const result = await runCqaAgent({
      businessId: business.id,
      userId: user.id,
      agentKey: role.agent,
      task: input.task,
      metadata: { source: "owner_worker", workerId: input.workerId }
    }, [
      "Prepare drafts and recommendations for owner review. Sending messages, booking, publishing and changing orders require owner action. Exclude one-off customer and lead details from memory_candidates.",
      role.instruction
    ].join("\n"));
    return NextResponse.json(result);
  } catch (e) {
    const status = e instanceof z.ZodError ? 400 : Number((e as { status?: number })?.status || 500);
    return NextResponse.json({ error: status === 500 ? "The worker could not complete this request. Please try again." : (e as Error).message }, { status });
  }
}
