import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCqaOwner } from "@/lib/cqa-owner-auth";
import { runCqaAgent, type CqaAgentKey } from "@/lib/cqa-ai-core";
import { isActiveBillingStatus } from "@/lib/cqa-billing";

const roles: Record<string, { agent: CqaAgentKey; instruction: string }> = {
  receptionist: { agent: "support", instruction: "Act as the business receptionist: draft accurate FAQ answers, qualify enquiries, and prepare booking requests for owner review. Do not claim a booking is confirmed." },
  sales: { agent: "product", instruction: "Act as a sales worker: qualify the lead, match only existing offers and draft a follow-up for owner review. Never invent prices or availability." },
  marketing: { agent: "marketing", instruction: "Draft marketing content for owner review; do not claim it has been sent or published." }
};
export async function POST(req: Request) {
  try {
    const input = z.object({ workerId: z.enum(["receptionist", "sales", "marketing"]), task: z.string().trim().min(2).max(4000) }).parse(await req.json());
    const { business, user, admin } = await requireCqaOwner(req);
    const [plan, worker] = await Promise.all([
      admin.from("cqa_plan_subscriptions").select("status").eq("business_id", business.id).maybeSingle(),
      admin.from("cqa_worker_subscriptions").select("status").eq("business_id", business.id).eq("worker_id", input.workerId).maybeSingle()
    ]);
    if (plan.error) throw plan.error;
    if (worker.error) throw worker.error;
    if (!isActiveBillingStatus(plan.data?.status) || !isActiveBillingStatus(worker.data?.status)) return NextResponse.json({ error: "Activate your machine plan and this worker subscription first." }, { status: 403 });
    const role = roles[input.workerId];
    const result = await runCqaAgent({ businessId: business.id, userId: user.id, agentKey: role.agent, task: `${role.instruction}\n\nOwner request: ${input.task}`, metadata: { source: "owner_worker", workerId: input.workerId } });
    return NextResponse.json(result);
  } catch (e) {
    const status = e instanceof z.ZodError ? 400 : Number((e as { status?: number })?.status || 500);
    return NextResponse.json({ error: status === 500 ? "The worker could not complete this request. Please try again." : (e as Error).message }, { status });
  }
}
