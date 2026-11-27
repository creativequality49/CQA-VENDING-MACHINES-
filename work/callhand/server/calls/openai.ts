// One chat completion with bounded retries. A live call has a tight latency
// budget, so retries are few and short; anything but 429/5xx fails at once.
import { env } from '../env';

export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export type ToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } };

export type ChatReply = { content: string | null; toolCalls: ToolCall[] };

export type Chat = (messages: ChatMessage[], tools: readonly unknown[]) => Promise<ChatReply>;

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 250;
const TIMEOUT_MS = 12_000;

export function createOpenAiChat(apiKey = env.OPENAI_API_KEY, model = env.OPENAI_MODEL, fetchImpl: typeof fetch = fetch): Chat {
  return async (messages, tools) => {
    let lastError: Error = new Error('OPENAI_FAILED');
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      let response: Response;
      try {
        response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
          body: JSON.stringify({ model, messages, ...(tools.length ? { tools } : {}) }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('OPENAI_NETWORK_FAILED');
        if (attempt < MAX_RETRIES) { await new Promise((r) => setTimeout(r, RETRY_DELAY_MS)); continue; }
        throw lastError;
      }
      if (!response.ok) {
        lastError = new Error(`OPENAI_FAILED:${response.status}`);
        if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          continue;
        }
        throw lastError;
      }
      const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string | null; tool_calls?: ToolCall[] } }> };
      const message = payload.choices?.[0]?.message;
      if (!message) throw new Error('OPENAI_EMPTY');
      return { content: message.content ?? null, toolCalls: message.tool_calls ?? [] };
    }
    throw lastError;
  };
}
