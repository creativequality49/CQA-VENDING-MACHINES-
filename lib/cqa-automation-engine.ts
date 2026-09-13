import "server-only";
import { Resend } from "resend";
import { getCqaSupabaseAdmin } from "@/lib/cqa-supabase-admin";

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
      results.push({ automationId: automation.id, runId: run.id, status: run.status });
    } catch (runError) {
      results.push({ automationId: automation.id, error: runError instanceof Error ? runError.message : "Automation failed." });
    }
  }
  return results;
}

export async function startAutomationRun(automationId: string, triggerType: string, triggerPayload: Json = {}, contactId: string | null = null) {
  const admin = getCqaSupabaseAdmin();
  const { data: automation, error } = await admin.from("cqa_automations").select("id,business_id,status,trigger_type").eq("id", automationId).single();
  if (error || !automation) throw new Error("Automation not found.");
  if (automation.status !== "active") throw new Error("Automation is not active.");
  const { data: run, error: runError } = await admin.from("cqa_automation_runs").insert({
    business_id: automation.business_id,
    automation_id: automation.id,
    contact_id: contactId,
    trigger_type: triggerType || automation.trigger_type,
    trigger_payload: triggerPayload,
    status: "queued"
  }).select("id,status").single();
  if (runError || !run) throw new Error(runError?.message || "Unable to start automation.");
  await processAutomationRun(run.id);
  const { data: finished } = await admin.from("cqa_automation_runs").select("id,status,next_run_at,error_text").eq("id", run.id).single();
  return finished || run;
}

export async function processAutomationRun(runId: string) {
  const admin = getCqaSupabaseAdmin();
  const { data: run, error: runError } = await admin.from("cqa_automation_runs").select("*").eq("id", runId).single();
  if (runError || !run) throw new Error("Automation run not found.");
  if (["succeeded", "failed"].includes(run.status)) return run;

  const [{ data: automation }, { data: business }, { data: contact }, { data: contextItems }, { data: steps }] = await Promise.all([
    admin.from("cqa_automations").select("id,name,status").eq("id", run.automation_id).single(),
    admin.from("cqa_businesses").select("id,name,description,email").eq("id", run.business_id).single(),
    run.contact_id ? admin.from("cqa_contacts").select("id,email,name,tags,status").eq("id", run.contact_id).maybeSingle() : Promise.resolve({ data: null }),
    admin.from("cqa_context_items").select("kind,title,content").eq("business_id", run.business_id).eq("active", true).limit(30),
    admin.from("cqa_automation_steps").select("id,step_order,step_type,name,config,enabled").eq("automation_id", run.automation_id).eq("enabled", true).order("step_order")
  ]);
  if (!automation || automation.status !== "active" || !business) throw new Error("Automation configuration is unavailable.");

  let output = run.output || {};
  await admin.from("cqa_automation_runs").update({ status: "running", started_at: run.started_at || new Date().toISOString(), next_run_at: null, updated_at: new Date().toISOString() }).eq("id", runId);

  const values = {
    first_name: firstName(contact?.name),
    business_name: business.name || "CQA business",
    business_email: business.email || "",
    automation_name: automation.name || "Automation"
  };

  try {
    for (const step of (steps || []).filter((item) => item.step_order >= (run.current_step_order || 1))) {
      const config = (step.config || {}) as StepConfig;
      if (step.step_type === "wait") {
        const raw = Number(config.minutes ?? 60);
        const minutes = Math.min(Math.max(Number.isFinite(raw) ? raw : 60, 1), 10080);
        const next = new Date(Date.now() + minutes * 60_000).toISOString();
        output = appendOutput(output, { step: step.step_order, type: "wait", status: "waiting", until: next });
        await admin.from("cqa_automation_runs").update({ status: "waiting", current_step_order: step.step_order + 1, next_run_at: next, output, updated_at: new Date().toISOString() }).eq("id", runId);
        return;
      }

      if (step.step_type === "tag") {
        if (contact?.id) {
          const tag = String(config.tag || "").trim().slice(0, 60);
          const tags = Array.from(new Set([...(contact.tags || []), tag].filter(Boolean)));
          await admin.from("cqa_contacts").update({ tags, updated_at: new Date().toISOString() }).eq("id", contact.id);
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
            await admin.from("cqa_automation_runs").update({ status: "needs_approval", current_step_order: step.step_order, output, updated_at: new Date().toISOString() }).eq("id", runId);
            return;
          }
          const resend = new Resend(apiKey);
          const subject = render(String(config.subject || "Message from {{business_name}}"), values);
          const body = render(String(config.body || ""), values);
          const result = await resend.emails.send({ from, to: contact.email, reply_to: business.email || undefined, subject, text: body });
          output = appendOutput(output, { step: step.step_order, type: "email", status: "sent", provider_id: result.data?.id || null });
        }
      }

      if (step.step_type === "agent_task") {
        const apiKey = process.env.CQA_CHAT_API_KEY || process.env.OPENAI_API_KEY;
        const apiUrl = process.env.CQA_CHAT_API_URL || "https://api.openai.com/v1/chat/completions";
        const model = process.env.CQA_CHAT_MODEL || "gpt-4.1-mini";
        if (!apiKey) {
          output = appendOutput(output, { step: step.step_order, type: "agent_task", status: "needs_approval", reason: "ai_provider_not_configured" });
          await admin.from("cqa_automation_runs").update({ status: "needs_approval", current_step_order: step.step_order, output, updated_at: new Date().toISOString() }).eq("id", runId);
          return;
        }
        const context = (contextItems || []).map((item) => `${item.title}: ${item.content}`).join("\n").slice(0, 12000);
        const instruction = render(String(config.instruction || "Complete the requested business task."), values);
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, temperature: 0.4, max_tokens: 700, messages: [
            { role: "system", content: `You are a CQA business operations agent for ${business.name}. Use supplied context only where relevant. Never claim an action was executed unless it actually was. Flag payment, legal, irreversible, or sensitive actions for human approval.\n\nShared context:\n${context || "No additional shared context."}` },
            { role: "user", content: `${instruction}\n\nTrigger payload:\n${JSON.stringify(run.trigger_payload || {})}` }
          ] })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(`AI provider failed with status ${response.status}.`);
        const text = data?.choices?.[0]?.message?.content || data?.output_text || "";
        output = appendOutput(output, { step: step.step_order, type: "agent_task", status: "completed", result: String(text).slice(0, 8000) });
      }

      if (step.step_type === "webhook") {
        const url = String(config.url || "");
        const allowlist = (process.env.CQA_WEBHOOK_ALLOWLIST || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
        let parsed: URL | null = null;
        try { parsed = new URL(url); } catch { parsed = null; }
        if (!parsed || parsed.protocol !== "https:" || !allowlist.includes(parsed.hostname.toLowerCase())) {
          output = appendOutput(output, { step: step.step_order, type: "webhook", status: "needs_approval", reason: "destination_not_allowlisted" });
          await admin.from("cqa_automation_runs").update({ status: "needs_approval", current_step_order: step.step_order, output, updated_at: new Date().toISOString() }).eq("id", runId);
          return;
        }
        const response = await fetch(parsed.toString(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: run.business_id, automationId: run.automation_id, runId, trigger: run.trigger_payload }) });
        if (!response.ok) throw new Error(`Webhook returned ${response.status}.`);
        output = appendOutput(output, { step: step.step_order, type: "webhook", status: "completed", http_status: response.status });
      }

      await admin.from("cqa_automation_runs").update({ current_step_order: step.step_order + 1, output, updated_at: new Date().toISOString() }).eq("id", runId);
    }
    await admin.from("cqa_automation_runs").update({ status: "succeeded", output, completed_at: new Date().toISOString(), next_run_at: null, updated_at: new Date().toISOString() }).eq("id", runId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Automation execution failed.";
    await admin.from("cqa_automation_runs").update({ status: "failed", error_text: message.slice(0, 2000), output, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", runId);
    throw error;
  }
}

export async function resumeDueAutomationRuns(limit = 25) {
  const admin = getCqaSupabaseAdmin();
  const { data: runs, error } = await admin.from("cqa_automation_runs").select("id").eq("status", "waiting").lte("next_run_at", new Date().toISOString()).order("next_run_at").limit(Math.min(Math.max(limit, 1), 100));
  if (error) throw new Error(error.message);
  const results = [];
  for (const run of runs || []) {
    try { await processAutomationRun(run.id); results.push({ id: run.id, ok: true }); }
    catch (error) { results.push({ id: run.id, ok: false, error: error instanceof Error ? error.message : "Execution failed." }); }
  }
  return results;
}
