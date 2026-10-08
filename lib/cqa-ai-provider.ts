import "server-only";

type ProviderConfig = { apiKey: string; apiUrl: string; model: string };
type Environment = Record<string, string | undefined>;
const gatewayBase = "https://ai-gateway.vercel.sh/v1";

// Gateway tokens are never attached to a user-configurable URL.
// Read the deployment token for each request, rather than caching it at module load.
export function getCqaChatProvider(env: Environment = process.env): ProviderConfig | null {
  const directKey = env.CQA_CHAT_API_KEY || env.OPENAI_API_KEY;
  if (directKey) return { apiKey: directKey, apiUrl: env.CQA_CHAT_API_URL || "https://api.openai.com/v1/chat/completions", model: env.CQA_CHAT_MODEL || "gpt-4.1-mini" };
  const gatewayKey = env.AI_GATEWAY_API_KEY || env.VERCEL_OIDC_TOKEN;
  if (!gatewayKey) return null;
  return { apiKey: gatewayKey, apiUrl: `${gatewayBase}/chat/completions`, model: env.AI_GATEWAY_MODEL || "openai/gpt-4.1-mini" };
}

export function getCqaEmbeddingProvider(env: Environment = process.env): ProviderConfig | null {
  const directKey = env.CQA_EMBEDDING_API_KEY || env.OPENAI_API_KEY || env.CQA_CHAT_API_KEY;
  if (directKey) return { apiKey: directKey, apiUrl: env.CQA_EMBEDDINGS_API_URL || "https://api.openai.com/v1/embeddings", model: env.CQA_EMBEDDING_MODEL || "text-embedding-3-small" };
  const gatewayKey = env.AI_GATEWAY_API_KEY || env.VERCEL_OIDC_TOKEN;
  if (!gatewayKey) return null;
  return { apiKey: gatewayKey, apiUrl: `${gatewayBase}/embeddings`, model: env.AI_GATEWAY_EMBEDDING_MODEL || "openai/text-embedding-3-small" };
}
