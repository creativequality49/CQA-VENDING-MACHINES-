import "server-only";
import { getCqaSupabaseAdmin } from "@/lib/cqa-supabase-admin";

export type CqaAgentKey =
  | "business_manager"
  | "marketing"
  | "product"
  | "support"
  | "accounts"
  | "compliance"
  | "builder";

type Json = Record<string, unknown>;

type KnowledgeItem = {
  id: string;
  kind: string;
  title: string;
  content: string;
  similarity?: number;
};

type ProviderResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  output_text?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    input_tokens?: number;
    output_tokens?: number;
  };
};

const AGENT_INSTRUCTIONS: Record<CqaAgentKey, string> = {
  business_manager:
    "Coordinate business priorities, identify the highest-value next action, and produce an execution-ready result.",
  marketing:
    "Create commercially useful marketing outputs grounded in the business offer, audience, brand and available evidence. Do not invent performance claims.",
  product:
    "Develop products, offers, descriptions, pricing logic and merchandising recommendations from the supplied business facts. Flag unsupported assumptions.",
  support:
    "Resolve customer questions accurately from business context. Escalate refunds, legal issues, payment disputes, safety issues and uncertain policy questions.",
  accounts:
    "Prepare administrative finance summaries and categorisation suggestions only. Never claim to have moved money, filed taxes or given regulated financial advice.",
  compliance:
    "Identify compliance, privacy, policy and operational risks from supplied facts. Do not present general guidance as legal advice.",
  builder:
    "Turn business requirements into structured machine configuration, content, workflows and implementation tasks. Preserve tenant isolation and approval gates."
};

const BASE_RULES = [
  "You are part of the CQA AI Business Workforce.",
  "Use retrieved business knowledge and memory as the primary source of business-specific facts.",
  "Do not invent products, prices, policies, integrations, results, discounts, legal status or completed actions.",
  "Never state that an external action was executed unless the system explicitly provides execution evidence.",
  "Payments, refunds, money movement, legal commitments, destructive changes, account/security changes and irreversible publishing require human approval.",
  "Keep customer and business data isolated to the supplied business_id.",
  "Return valid JSON only with keys: answer, approval_required, next_actions, memory_candidates.",
  "next_actions must be an array of short strings.",
  "memory_candidates must be an array of objects with keys key and content, containing only durable business facts worth retaining."
].join("\n");

function providerText(data: ProviderResponse) {
  return (
    data.choices?.[0]?.message?.content ||
    data.output_text ||
    ""
  ).trim();
}

function parseAgentPayload(raw: string) {
  try {
    const parsed = JSON.parse(raw) as {
      answer?: unknown;
      approval_required?: unknown;
      next_actions?: unknown;
      memory_candidates?: unknown;
    };
    return {
      answer: typeof parsed.answer === "string" ? parsed.answer : raw,
      approvalRequired: parsed.approval_required === true,
      nextActions: Array.isArray(parsed.next_actions)
        ? parsed.next_actions.filter((item): item is string => typeof item === "string").slice(0, 8)
        : [],
      memoryCandidates: Array.isArray(parsed.memory_candidates)
        ? parsed.memory_candidates
            .filter((item) => item && typeof item === "object")
            .map((item) => item as { key?: unknown; content?: unknown })
            .filter((item) => typeof item.key === "string" && typeof item.content === "string")
            .slice(0, 8)
        : []
    };
  } catch {
    return { answer: raw, approvalRequired: false, nextActions: [], memoryCandidates: [] };
  }
}

export async function embedText(text: string) {
  const apiKey =
    process.env.CQA_EMBEDDING_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.CQA_CHAT_API_KEY;
  if (!apiKey) throw new Error("Embedding provider is not configured.");

  const apiUrl =
    process.env.CQA_EMBEDDINGS_API_URL ||
    "https://api.openai.com/v1/embeddings";
  const model = process.env.CQA_EMBEDDING_MODEL || "text-embedding-3-small";

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: text.slice(0, 16000)
    }),
    cache: "no-store"
  });

  const data = (await response.json().catch(() => ({}))) as {
    data?: Array<{ embedding?: number[] }>;
  };
  if (!response.ok) throw new Error("Embedding provider failed with status " + response.status + ".");
  const embedding = data.data?.[0]?.embedding;
  if (!Array.isArray(embedding) || embedding.length !== 1536) {
    throw new Error("Embedding provider returned an unexpected vector.");
  }
  return { embedding, model };
}

async function recentKnowledge(businessId: string, limit: number): Promise<KnowledgeItem[]> {
  const admin = getCqaSupabaseAdmin();
  const { data, error } = await admin
    .from("cqa_context_items")
    .select("id,kind,title,content")
    .eq("business_id", businessId)
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data || []) as KnowledgeItem[];
}

export async function searchBusinessKnowledge(
  businessId: string,
  query: string,
  limit = 8
): Promise<KnowledgeItem[]> {
  const admin = getCqaSupabaseAdmin();
  const cappedLimit = Math.min(Math.max(limit, 1), 12);

  try {
    const { embedding } = await embedText(query);
    const { data, error } = await admin.rpc("match_cqa_context", {
      query_embedding: embedding,
      match_business_id: businessId,
      match_count: cappedLimit,
      match_threshold: 0.55
    });
    if (!error && Array.isArray(data) && data.length) {
      return data as KnowledgeItem[];
    }
  } catch {
    // Launch-safe fallback: keyword/recency context remains available even if embeddings are unavailable.
  }

  return recentKnowledge(businessId, cappedLimit);
}

async function loadMemories(businessId: string, userId: string | null, limit = 12) {
  if (!userId) return [];
  const admin = getCqaSupabaseAdmin();
  const { data } = await admin
    .from("cqa_ai_memories")
    .select("namespace,memory_key,content,updated_at")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .limit(limit);
  return data || [];
}

export async function rememberBusinessFact(input: {
  businessId: string;
  userId: string;
  key: string;
  content: string;
  namespace?: string;
  metadata?: Json;
}) {
  const admin = getCqaSupabaseAdmin();
  const { error } = await admin.from("cqa_ai_memories").upsert(
    {
      business_id: input.businessId,
      user_id: input.userId,
      namespace: input.namespace || "business",
      memory_key: input.key.slice(0, 120),
      content: input.content.slice(0, 8000),
      metadata: input.metadata || {},
      active: true,
      updated_at: new Date().toISOString()
    },
    { onConflict: "business_id,user_id,namespace,memory_key" }
  );
  if (error) throw new Error(error.message);
}

export async function indexContextItem(businessId: string, itemId: string) {
  const admin = getCqaSupabaseAdmin();
  const { data: item, error } = await admin
    .from("cqa_context_items")
    .select("id,title,content")
    .eq("id", itemId)
    .eq("business_id", businessId)
    .single();
  if (error || !item) throw new Error("Business knowledge item not found.");

  const { embedding, model } = await embedText(item.title + "\n" + item.content);
  const { error: updateError } = await admin
    .from("cqa_context_items")
    .update({
      embedding,
      embedding_model: model,
      updated_at: new Date().toISOString()
    })
    .eq("id", item.id)
    .eq("business_id", businessId);
  if (updateError) throw new Error(updateError.message);
  return { id: item.id, model };
}

export async function runCqaAgent(input: {
  businessId: string;
  userId: string | null;
  agentKey: CqaAgentKey;
  task: string;
  additionalContext?: Json;
  metadata?: Json;
}) {
  const startedAt = Date.now();
  const admin = getCqaSupabaseAdmin();

  let businessQuery = admin
    .from("cqa_businesses")
    .select("id,name,category,description,email,website,plan,status,owner_id")
    .eq("id", input.businessId);
  if (input.userId) businessQuery = businessQuery.eq("owner_id", input.userId);
  const { data: business, error: businessError } = await businessQuery.single();
  if (businessError || !business) throw new Error("Business workspace is unavailable.");

  const apiKey = process.env.CQA_CHAT_API_KEY || process.env.OPENAI_API_KEY;
  const apiUrl =
    process.env.CQA_CHAT_API_URL ||
    "https://api.openai.com/v1/chat/completions";
  const model = process.env.CQA_CHAT_MODEL || "gpt-4.1-mini";

  const { data: run } = await admin
    .from("cqa_ai_runs")
    .insert({
      business_id: business.id,
      user_id: input.userId,
      agent_key: input.agentKey,
      model,
      status: "running",
      request_excerpt: input.task.slice(0, 1000),
      metadata: input.metadata || {}
    })
    .select("id")
    .single();

  try {
    if (!apiKey) throw new Error("CQA AI provider is not configured.");

    const [knowledge, memories] = await Promise.all([
      searchBusinessKnowledge(business.id, input.task, 8),
      loadMemories(business.id, input.userId)
    ]);

    const knowledgeText = knowledge
      .map((item, index) =>
        String(index + 1) + ". [" + item.kind + "] " + item.title + ": " + item.content
      )
      .join("\n")
      .slice(0, 14000);

    const memoryText = memories
      .map((item) => String(item.memory_key) + ": " + String(item.content))
      .join("\n")
      .slice(0, 6000);

    const businessProfile = JSON.stringify({
      id: business.id,
      name: business.name,
      category: business.category,
      description: business.description,
      email: business.email,
      website: business.website,
      plan: business.plan,
      status: business.status
    });

    const systemMessage = [
      BASE_RULES,
      "",
      "ROLE:",
      AGENT_INSTRUCTIONS[input.agentKey],
      "",
      "BUSINESS PROFILE:",
      businessProfile,
      "",
      "RETRIEVED KNOWLEDGE:",
      knowledgeText || "No stored business knowledge matched this task.",
      "",
      "DURABLE MEMORY:",
      memoryText || "No durable memory stored."
    ].join("\n");

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 1100,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemMessage },
          {
            role: "user",
            content: [
              "TASK:",
              input.task.slice(0, 8000),
              "",
              "ADDITIONAL CONTEXT:",
              JSON.stringify(input.additionalContext || {})
            ].join("\n")
          }
        ]
      }),
      cache: "no-store"
    });

    const data = (await response.json().catch(() => ({}))) as ProviderResponse;
    if (!response.ok) throw new Error("AI provider failed with status " + response.status + ".");

    const raw = providerText(data);
    if (!raw) throw new Error("AI provider returned an empty response.");
    const parsed = parseAgentPayload(raw);
    const usage = data.usage || {};

    if (input.userId && parsed.memoryCandidates.length) {
      await Promise.all(
        parsed.memoryCandidates.map((candidate) =>
          rememberBusinessFact({
            businessId: business.id,
            userId: input.userId as string,
            key: String(candidate.key),
            content: String(candidate.content),
            namespace: "agent",
            metadata: { source: input.agentKey }
          }).catch(() => undefined)
        )
      );
    }

    if (run?.id) {
      await admin
        .from("cqa_ai_runs")
        .update({
          status: parsed.approvalRequired ? "needs_approval" : "succeeded",
          approval_required: parsed.approvalRequired,
          input_tokens: usage.prompt_tokens ?? usage.input_tokens ?? null,
          output_tokens: usage.completion_tokens ?? usage.output_tokens ?? null,
          latency_ms: Date.now() - startedAt,
          response_excerpt: parsed.answer.slice(0, 2000),
          completed_at: new Date().toISOString()
        })
        .eq("id", run.id);
    }

    return {
      runId: run?.id || null,
      agentKey: input.agentKey,
      text: parsed.answer,
      approvalRequired: parsed.approvalRequired,
      nextActions: parsed.nextActions,
      sources: knowledge.map((item) => ({
        id: item.id,
        title: item.title,
        kind: item.kind,
        similarity: item.similarity ?? null
      }))
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "CQA AI execution failed.";
    if (run?.id) {
      await admin
        .from("cqa_ai_runs")
        .update({
          status: "failed",
          error_text: message.slice(0, 2000),
          latency_ms: Date.now() - startedAt,
          completed_at: new Date().toISOString()
        })
        .eq("id", run.id);
    }
    throw error;
  }
}
