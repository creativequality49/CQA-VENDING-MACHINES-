import { getCqaChatProvider } from "@/lib/cqa-ai-provider";
import "server-only";
import { Resend } from "resend";
import { getCqaSupabaseAdmin } from "@/lib/cqa-supabase-admin";
import { runCqaAgent } from "@/lib/cqa-ai-core";
import { purchaseAutomationRunId } from "@/lib/cqa-purchase-run-id";

type Json = Record<string, unknown>;
type StepConfig = Record<string, unknown>;

type TemplateStep = { step_type: "email" | "wait" | "tag" | "agent_task" | "webhook"; name: string; config: StepConfig };
export type AutomationTemplate = { key: string; name: string; description: string; trigger_type: "manual" | "new_contact" | "new_booking" | "purchase" | "tag_added" | "schedule"; steps: TemplateStep[] };

export const CQA_AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    key: "subscriber-welcome",
    name: "New subscriber welcome",
    description: "Welcome a new subscriber immediately, tag them as a lead, then prepare a personalised follow-up.",
    trigger_type: "new_contact",
    steps: [
      { step_type: "email", name: "Welcome email", config: { subject: "Welcome to {{business_name}}", body: "Hi {{first_name}},\n\nThanks for joining {{business_name}}. You are now on the list for updates, offers and useful information.\n\n— {{business_name}}" } },
      { step_type: "tag", name: "Tag new lead", config: { tag: "new-lead" } },
      { step_type: "wait", name: "Wait one day", config: { minutes: 1440 } },
      { step_type: "agent_task", name: "Prepare personalised follow-up", config: { instruction: "Draft a concise follow-up email for this subscriber based on the business context and trigger payload. Do not invent discounts or promises." } }
    ]
  },
  {
    key: "booking-follow-up",
    name: "Booking / enquiry follow-up",
    description: "Acknowledge a customer request, tag the lead, and prepare the next response for the owner.",
    trigger_type: "new_booking",
    steps: [
      { step_type: "email", name: "Request received", config: { subject: "We received your request — {{business_name}}", body: "Hi {{first_name}},\n\nThanks for contacting {{business_name}}. Your request has been received and we will review the details shortly.\n\n— {{business_name}}" } },
      { step_type: "tag", name: "Tag booking lead", config: { tag: "booking-lead" } },
      { step_type: "agent_task", name: "Prepare owner response", config: { instruction: "Summarise the booking or enquiry and draft the best next customer response. Keep claims factual and flag anything that requires owner approval." } }
    ]
  },
  {
    key: "purchase-aftercare",
    name: "Purchase aftercare",
    description: "Thank buyers and prepare a relevant next-step or cross-sell without aggressive selling.",
    trigger_type: "purchase",
    steps: [
      { step_type: "email", name: "Purchase thank-you", config: { subject: "Thanks for your purchase — {{business_name}}", body: "Hi {{first_name}},\n\nThanks for your purchase from {{business_name}}. Keep this email for your records. If you need help with your order, reply to this message.\n\n— {{business_name}}" } },
      { step_type: "tag", name: "Tag customer", config: { tag: "customer" } },
      { step_type: "wait", name: "Wait two days", config: { minutes: 2880 } },
      { step_type: "agent_task", name: "Prepare aftercare", config: { instruction: "Draft a short aftercare message and one relevant next-step recommendation based only on the business offers and trigger payload." } }
    ]
  },
  {
    key: "manual-business-agent",
    name: "Business task agent",
    description: "Run a reusable agent task against shared business context and record the result for review.",
    trigger_type: "manual",
    steps: [
      { step_type: "agent_task", name: "Complete business task", config: { instruction: "Complete the requested business task using the shared business context. Return a concise result, assumptions, and any action that needs human approval." } }
    ]
  }
];

function firstName(name?: string | null) {
  return (name || "there").trim().split(/\s+/)[0] || "there";
}

function render(template: string, values: Record<string, string>) {
  return template.replace(/\{\{([a-z0-9_]+)\}\}/gi, (_match, key: string) => values[key] ?? "");
}

function appendOutput(current: unknown, entry: Json) {
  const value = current && typeof current === "object" && !Array.isArray(current) ? (current as Json) : {};
  const steps = Array.isArray(value.steps) ? value.steps : [];
  return { ...value, steps: [...steps, entry] };
}

export async function createAutomationFromTemplate(businessId: string, userId: string, templateKey: string, customName?: string) {
  const template = CQA_AUTOMATION_TEMPLATES.find((item) => item.key === templateKey);
  if (!template) throw new Error("Automation template not found.");
  const admin = getCqaSupabaseAdmin();
  const { data: automation, error } = await admin.from("cqa_automations").insert({
    business_id: businessId,
    name: customName?.trim() || template.name,
    description: template.description,
    trigger_type: template.trigger_type,
    status: "active",
    template_key: template.key,
    created_by: userId
  }).select("id,business_id,name,trigger_type,status").single();
  if (error || !automation) throw new Error(error?.message || "Unable to create automation.");

  const { error: stepError } = await admin.from("cqa_automation_steps").insert(template.steps.map((step, index) => ({
    automation_id: automation.id,
    business_id: businessId,
    step_order: index + 1,
    step_type: step.step_type,
    name: step.name,
    config: step.config
  })));
  if (stepError) {
    await admin.from("cqa_automations").delete().eq("id", automation.id);
    throw new Error(stepError.message);
  }
  return automation;
}

export async function triggerBusinessAutomations(businessId: string, triggerType: string, triggerPayload: Json, contactId?: string | null) {
  const admin = getCqaSupabaseAdmin();
  const { data: automations, error } = await admin.from("cqa_automations").select("id").eq("business_id", businessId).eq("trigger_type", triggerType).eq("status", "active");
  if (error) throw new Error(error.message);
  const results: Array<{ automationId: string; runId?: string; status?: string; error?: string }> = [];
  for (const automation of automations || []) {
    try {
      const run = await startAutomationRun(automation.id, triggerType, triggerPayload, contactId || null);
      if (triggerType === "purchase" && run.status === "failed") throw new Error("Purchase automation requires review.");
      results.push({ automationId: automation.id, runId: run.id, status: run.status });
    } catch (runError) {
      results.push({ automationId: automation.id, error: runError instanceof Error ? runError.message : "Automation failed." });
    }
  }
  // Stripe must retry scheduling failures instead of recording a false success.
  if (triggerType === "purchase" && results.some(result => result.error)) {
    throw new Error("Purchase automation scheduling failed. Recorded runs require review or retry.");
  }
  return results;
}

export async function startAutomationRun(automationId: string, triggerType: string, triggerPayload: Json = {}, contactId: string | null = null) {
  const admin = getCqaSupabaseAdmin();
  const { data: automation, error } = await admin.from("cqa_automations").select("id,business_id,status,trigger_type").eq("id", automationId).single();
  if (error || !automation) throw new Error("Automation not found.");
  if (automation.status !== "active") throw new Error("Automation is not active.");
  const effectiveTrigger = triggerType || automation.trigger_type;
  const purchaseId = effectiveTrigger === "purchase"
    ? purchaseAutomationRunId(automation.business_id, automation.id, triggerPayload.checkoutSessionId as string) : null;
  const runFields = "id,business_id,automation_id,trigger_type,trigger_payload,status,next_run_at,error_text";
  const validPurchaseRun = (existing: Record<string, unknown> | null) => {
    const payload = existing?.trigger_payload;
    return Boolean(existing && typeof existing.id === "string" && typeof existing.status === "string" &&
      existing.business_id === automation.business_id && existing.automation_id === automation.id &&
      existing.trigger_type === "purchase" && payload && typeof payload === "object" && !Array.isArray(payload) &&
      (payload as Json).checkoutSessionId === triggerPayload.checkoutSessionId);
  };
  if (purchaseId) {
    // Honour older random-ID runs too: a delayed event must not repeat their work.
    const { data: existing, error: existingError } = await admin.from("cqa_automation_runs")
      .select(runFields).eq("business_id", automation.business_id).eq("automation_id", automation.id)
      .eq("trigger_type", "purchase").contains("trigger_payload", { checkoutSessionId: triggerPayload.checkoutSessionId })
      .order("created_at").limit(1).maybeSingle();
    if (existingError) throw new Error("Unable to verify existing purchase automation.");
    if (existing) {
      if (!validPurchaseRun(existing)) throw new Error("Existing purchase automation does not match.");
      return existing;
    }
  }
  const { data: run, error: runError } = await admin.from("cqa_automation_runs").insert({
    ...(purchaseId ? { id: purchaseId } : {}),
    business_id: automation.business_id,
    automation_id: automation.id,
    contact_id: contactId,
    trigger_type: effectiveTrigger,
    trigger_payload: triggerPayload,
    ...(purchaseId ? { output: { _cqaPurchaseRunVersion: 1 } } : {}),
    status: "queued"
  }).select("id,status").single();
  if (purchaseId && runError?.code === "23505") {
    const { data: existing, error: existingError } = await admin.from("cqa_automation_runs")
      .select(runFields).eq("id", purchaseId).eq("business_id", automation.business_id)
      .eq("automation_id", automation.id).eq("trigger_type", "purchase").maybeSingle();
    if (existingError || !existing || !validPurchaseRun(existing)) throw new Error("Unable to confirm duplicate purchase automation.");
    return existing;
  }
  if (runError || !run) throw new Error(runError?.message || "Unable to start automation.");
  await processAutomationRun(run.id);
  const { data: finished, error: finishError } = await admin.from("cqa_automation_runs").select("id,status,next_run_at,error_text").eq("id", run.id).single();
  if (finishError) throw new Error("Unable to verify automation status.");
  return finished || run;
}

export async function processAutomationRun(runId: string) {
  const admin = getCqaSupabaseAdmin();
  const { data: initialRun, error: runError } = await admin.from("cqa_automation_runs").select("*").eq("id", runId).single();
  let run = initialRun;
  if (runError || !run) throw new Error("Automation run not found.");
  if (!["queued", "waiting"].includes(run.status)) return run;
  if (run.status === "waiting" && (!run.next_run_at || !Number.isFinite(Date.parse(run.next_run_at)) || Date.parse(run.next_run_at) > Date.now())) return run;

  // One worker owns each queued/due-waiting snapshot. Never automatically replay
  // running or failed work whose external effects may already have occurred.
  let claim = admin.from("cqa_automation_runs").update({
    status: "running", started_at: run.started_at || new Date().toISOString(),
    next_run_at: null, updated_at: new Date().toISOString()
  }).eq("id", runId).eq("status", run.status).eq("current_step_order", run.current_step_order);
  claim = run.updated_at ? claim.eq("updated_at", run.updated_at) : claim.is("updated_at", null);
  claim = run.next_run_at ? claim.eq("next_run_at", run.next_run_at) : claim.is("next_run_at", null);
  const { data: claimed, error: claimError } = await claim.select("*").maybeSingle();
  if (claimError) throw new Error("Unable to claim automation execution.");
  if (!claimed) {
    const { data: current, error: currentError } = await admin.from("cqa_automation_runs").select("*").eq("id", runId).single();
    if (currentError || !current) throw new Error("Unable to verify automation execution ownership.");
    return current;
  }
  run = claimed;
  let output = run.output || {};
  async function saveRun(changes: Json) {
    const { data: saved, error: saveError } = await admin.from("cqa_automation_runs")
      .update(changes).eq("id", runId).eq("status", "running").select("id").maybeSingle();
    if (saveError || !saved) throw new Error("Unable to persist automation execution state.");
  }
  try {

    const [automationResult, businessResult, contactResult, stepsResult] = await Promise.all([
      admin.from("cqa_automations").select("id,name,status,created_by").eq("id", run.automation_id).single(),
      admin.from("cqa_businesses").select("id,name,description,email").eq("id", run.business_id).single(),
      run.contact_id ? admin.from("cqa_contacts").select("id,email,name,tags,status").eq("id", run.contact_id).maybeSingle() : Promise.resolve({ data: null }),
      admin.from("cqa_automation_steps").select("id,step_order,step_type,name,config,enabled").eq("automation_id", run.automation_id).eq("enabled", true).order("step_order")
    ]);
    if (automationResult.error || businessResult.error || stepsResult.error || ("error" in contactResult && contactResult.error)) throw new Error("Automation configuration is unavailable.");
    const automation = automationResult.data, business = businessResult.data, contact = contactResult.data, steps = stepsResult.data;
    if (!automation || automation.status !== "active" || !business) throw new Error("Automation configuration is unavailable.");

    const values = {
      first_name: firstName(contact?.name),
      business_name: business.name || "CQA business",
      business_email: business.email || "",
      automation_name: automation.name || "Automation"
    };

    for (const step of (steps || []).filter((item) => item.step_order >= (run.current_step_order || 1))) {
      const config = (step.config || {}) as StepConfig;
      if (step.step_type === "wait") {
        const raw = Number(config.minutes ?? 60);
        const minutes = Math.min(Math.max(Number.isFinite(raw) ? raw : 60, 1), 10080);
        const next = new Date(Date.now() + minutes * 60_000).toISOString();
        output = appendOutput(output, { step: step.step_order, type: "wait", status: "waiting", until: next });
        await saveRun({ status: "waiting", current_step_order: step.step_order + 1, next_run_at: next, output, updated_at: new Date().toISOString() });
        return;
      }

      if (step.step_type === "tag") {
        if (contact?.id) {
          const tag = String(config.tag || "").trim().slice(0, 60);
          const tags = Array.from(new Set([...(contact.tags || []), tag].filter(Boolean)));
          const { error: tagError } = await admin.from("cqa_contacts").update({ tags, updated_at: new Date().toISOString() }).eq("id", contact.id);
          if (tagError) throw new Error("Unable to update automation contact tags.");
          contact.tags = tags;
        }
        output = appendOutput(output, { step: step.step_order, type: "tag", status: "completed", tag: String(config.tag || "") });
      }

      if (step.step_type === "email") {
        if (!contact?.email) throw new Error("This automation email step has no subscriber/customer email address.");
        if (contact.status !== "subscribed") {
          output = appendOutput(output, { step: step.step_order, type: "email", status: "skipped", reason: "contact_not_subscribed" });
        } else {
          const apiKey = process.env.RESEND_API_KEY;
          const from = process.env.CQA_AUTOMATION_FROM_EMAIL || process.env.CQA_EMAIL_FROM;
          if (!apiKey || !from) {
            output = appendOutput(output, { step: step.step_order, type: "email", status: "needs_approval", reason: "email_provider_not_configured" });
            await saveRun({ status: "needs_approval", current_step_order: step.step_order, output, updated_at: new Date().toISOString() });
            return;
          }
          const resend = new Resend(apiKey);
          const subject = render(String(config.subject || "Message from {{business_name}}"), values);
          const body = render(String(config.body || ""), values);
          const result = await resend.emails.send({ from, to: contact.email, reply_to: business.email || undefined, subject, text: body });
          if (result.error) throw new Error(result.error.message);
          output = appendOutput(output, { step: step.step_order, type: "email", status: "sent", provider_id: result.data?.id || null });
        }
      }

      if (step.step_type === "agent_task") {
        if (!(await getCqaChatProvider())) {
          output = appendOutput(output, { step: step.step_order, type: "agent_task", status: "needs_approval", reason: "ai_provider_not_configured" });
          await saveRun({ status: "needs_approval", current_step_order: step.step_order, output, updated_at: new Date().toISOString() });
          return;
        }

        const instruction = render(String(config.instruction || "Complete the requested business task."), values);
        const agentResult = await runCqaAgent({
          businessId: run.business_id,
          userId: automation.created_by || null,
          agentKey: "business_manager",
          task: instruction,
          additionalContext: { triggerPayload: run.trigger_payload || {}, contactId: run.contact_id || null },
          metadata: { source: "automation", automationId: automation.id, automationRunId: runId, stepOrder: step.step_order }
        });

        output = appendOutput(output, {
          step: step.step_order,
          type: "agent_task",
          status: agentResult.approvalRequired ? "needs_approval" : "completed",
          result: agentResult.text.slice(0, 8000),
          ai_run_id: agentResult.runId,
          next_actions: agentResult.nextActions,
          sources: agentResult.sources
        });

        if (agentResult.approvalRequired) {
          await saveRun({
            status: "needs_approval",
            current_step_order: step.step_order,
            output,
            updated_at: new Date().toISOString()
          });
          return;
        }
      }

      if (step.step_type === "webhook") {
        const url = String(config.url || "");
        const allowlist = (process.env.CQA_WEBHOOK_ALLOWLIST || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
        let parsed: URL | null = null;
        try { parsed = new URL(url); } catch { parsed = null; }
        if (!parsed || parsed.protocol !== "https:" || !allowlist.includes(parsed.hostname.toLowerCase())) {
          output = appendOutput(output, { step: step.step_order, type: "webhook", status: "needs_approval", reason: "destination_not_allowlisted" });
          await saveRun({ status: "needs_approval", current_step_order: step.step_order, output, updated_at: new Date().toISOString() });
          return;
        }
        const response = await fetch(parsed.toString(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: run.business_id, automationId: run.automation_id, runId, trigger: run.trigger_payload }) });
        if (!response.ok) throw new Error(`Webhook returned ${response.status}.`);
        output = appendOutput(output, { step: step.step_order, type: "webhook", status: "completed", http_status: response.status });
      }

      await saveRun({ current_step_order: step.step_order + 1, output, updated_at: new Date().toISOString() });
    }
    await saveRun({ status: "succeeded", output, completed_at: new Date().toISOString(), next_run_at: null, updated_at: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Automation execution failed.";
    try {
      await saveRun({ status: "failed", error_text: message.slice(0, 2000), output, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    } catch {
      throw new Error("Automation failed and its failure state could not be confirmed.");
    }
    throw error;
  }
}

export async function resumeDueAutomationRuns(limit = 25) {
  const admin = getCqaSupabaseAdmin();
  const maximum = Math.min(Math.max(limit, 1), 100);
  const [queued, waiting] = await Promise.all([
    // Only this writer's marked deterministic purchases are safe to recover.
    // Legacy queued work can have ambiguous prior effects and needs review.
    admin.from("cqa_automation_runs").select("id,business_id,automation_id,trigger_type,trigger_payload,output,created_at")
      .eq("status", "queued").eq("trigger_type", "purchase")
      .contains("output", { _cqaPurchaseRunVersion: 1 }).order("created_at").limit(maximum),
    admin.from("cqa_automation_runs").select("id,next_run_at").eq("status", "waiting").lte("next_run_at", new Date().toISOString()).order("next_run_at").limit(maximum)
  ]);
  if (queued.error || waiting.error) throw new Error("Unable to read pending automation runs.");
  const invalid: Array<{ id: string; ok: boolean; error: string }> = [];
  const safeQueued = (queued.data || []).filter(run => {
    try {
      if (run.trigger_type === "purchase" && run.output?._cqaPurchaseRunVersion === 1 &&
          purchaseAutomationRunId(run.business_id, run.automation_id, run.trigger_payload?.checkoutSessionId) === run.id) return true;
    } catch { /* Invalid identity never executes automatically. */ }
    invalid.push({ id: run.id, ok: false, error: "Queued purchase automation identity requires review." });
    return false;
  });
  const candidates: Array<{ id: string; created_at?: string; next_run_at?: string }> = [...safeQueued, ...(waiting.data || [])];
  const runs = candidates.sort((a, b) => Date.parse(a.next_run_at || a.created_at || "") - Date.parse(b.next_run_at || b.created_at || "")).slice(0, maximum);
  const results: Array<{ id: string; ok: boolean; error?: string }> = [...invalid];
  for (const run of runs || []) {
    try { await processAutomationRun(run.id); results.push({ id: run.id, ok: true }); }
    catch (error) { results.push({ id: run.id, ok: false, error: error instanceof Error ? error.message : "Execution failed." }); }
  }
  return results;
}
