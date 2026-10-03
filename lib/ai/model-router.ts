export const AI_MODEL_FAMILIES = [
  "machine-learning",
  "deep-learning",
  "generative",
  "hybrid",
  "nlp",
  "computer-vision",
] as const;

export type AIModelFamily = (typeof AI_MODEL_FAMILIES)[number];
export type AIInputType = "text" | "image" | "video" | "audio" | "structured-data";
export type AIOutputType = "text" | "image" | "video" | "classification" | "score" | "action-plan";

export type AIExecutionRequest = {
  task: string;
  inputTypes?: AIInputType[];
  outputType?: AIOutputType;
  useBusinessKnowledge?: boolean;
  useHistoricalData?: boolean;
  requiresTools?: boolean;
  highRiskAction?: boolean;
};

export type AIExecutionPlan = {
  product: string;
  primaryFamily: AIModelFamily;
  families: AIModelFamily[];
  stages: Array<{ family: AIModelFamily; purpose: string }>;
  humanApprovalRequired: boolean;
  reason: string;
};

export const PRODUCT_AI_STACK = {
  product: "CQA Vending Machine OS",
  preferredOrder: ["hybrid","nlp","computer-vision","deep-learning","machine-learning","generative"] as AIModelFamily[],
  notes: "Core routing layer for AI Workers, onboarding, business knowledge/RAG, media analysis, generation and future conversion optimisation.",
  modelFamilies: {
    "machine-learning": "Use accumulated first-party data for scoring, forecasting, personalisation and optimisation.",
    "deep-learning": "Use neural models for high-dimensional media, sequence and representation tasks where a specialised model is warranted.",
    generative: "Create new text, image, video, code or structured content from approved inputs.",
    hybrid: "Coordinate language models, retrieval, business rules, databases, APIs and approval-gated actions.",
    nlp: "Understand intents, conversations, documents, prompts and other language inputs.",
    "computer-vision": "Analyse images/video for visual attributes, quality, continuity, classification and extraction.",
  },
} as const;

const hasAny = (value: string, words: string[]) => words.some((word) => value.includes(word));

export function buildAIExecutionPlan(input: AIExecutionRequest): AIExecutionPlan {
  const task = input.task.trim().toLowerCase();
  const inputs = new Set(input.inputTypes || ["text"]);
  const families = new Set<AIModelFamily>();

  if (
    inputs.has("text") ||
    hasAny(task, ["chat", "message", "copy", "caption", "support", "answer", "summar", "document", "intent", "tutor", "reception"])
  ) {
    families.add("nlp");
  }

  if (
    input.outputType === "image" ||
    input.outputType === "video" ||
    hasAny(task, ["generate", "create", "draft", "write", "design", "image", "video", "content", "lesson", "report"])
  ) {
    families.add("generative");
  }

  if (
    inputs.has("image") ||
    inputs.has("video") ||
    hasAny(task, ["vision", "visual", "logo", "photo", "face", "image analysis", "video analysis", "quality check"])
  ) {
    families.add("computer-vision");
  }

  if (
    input.useHistoricalData ||
    input.outputType === "score" ||
    hasAny(task, ["predict", "forecast", "score", "rank", "recommend", "optimise", "optimize", "conversion", "performance", "personalise", "personalize"])
  ) {
    families.add("machine-learning");
  }

  if (
    inputs.has("audio") ||
    (families.has("computer-vision") && hasAny(task, ["consistency", "identity", "motion", "sequence", "embedding", "feature"]))
  ) {
    families.add("deep-learning");
  }

  if (families.size === 0) families.add("nlp");

  if (
    input.requiresTools ||
    input.useBusinessKnowledge ||
    families.size > 1 ||
    hasAny(task, ["workflow", "automate", "orchestrate", "database", "api", "rag", "retrieve", "checkout", "publish", "schedule"])
  ) {
    families.add("hybrid");
  }

  const preferredOrder = PRODUCT_AI_STACK.preferredOrder;
  const ordered = [...families].sort(
    (a, b) => preferredOrder.indexOf(a) - preferredOrder.indexOf(b)
  );

  const purpose: Record<AIModelFamily, string> = {
    nlp: "Interpret language, intent and conversational context.",
    "computer-vision": "Extract and validate visual information from image/video inputs.",
    "deep-learning": "Handle complex learned representations for media, sequence or consistency tasks.",
    "machine-learning": "Use historical signals for prediction, scoring, recommendation or optimisation.",
    generative: "Create the requested draft, media or structured output.",
    hybrid: "Combine model outputs with retrieval, business rules, APIs, databases and controlled actions.",
  };

  const primaryFamily: AIModelFamily =
    families.has("hybrid")
      ? "hybrid"
      : ordered[0] || "nlp";

  return {
    product: PRODUCT_AI_STACK.product,
    primaryFamily,
    families: ordered,
    stages: ordered.map((family) => ({ family, purpose: purpose[family] })),
    humanApprovalRequired: Boolean(input.highRiskAction),
    reason:
      primaryFamily === "hybrid"
        ? "This task spans multiple capabilities or external systems, so CQA routes it through the hybrid orchestration layer."
        : `This task maps primarily to the ${primaryFamily} capability.`,
  };
}
