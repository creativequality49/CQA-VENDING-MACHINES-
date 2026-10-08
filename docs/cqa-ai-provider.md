# CQA AI provider configuration

Existing direct provider keys keep priority: `CQA_CHAT_API_KEY` or `OPENAI_API_KEY`, with existing `CQA_CHAT_API_URL` and `CQA_CHAT_MODEL` settings.

If no direct key exists, CQA uses `AI_GATEWAY_API_KEY`, then `VERCEL_OIDC_TOKEN`, with the fixed Vercel Gateway endpoints. Gateway tokens never use custom CQA API URLs. Defaults verified against the live catalog on 8 October 2026:

- Chat: `openai/gpt-4.1-mini` (`AI_GATEWAY_MODEL` override).
- Embeddings: `openai/text-embedding-3-small` (`AI_GATEWAY_EMBEDDING_MODEL` override).

Vercel builds provide `VERCEL_OIDC_TOKEN`; runtime Functions receive `x-vercel-oidc-token` in the platform request context. CQA uses the official `@vercel/oidc` request-time helper to retrieve the current token. Local tokens pulled with `vercel env pull` expire after 12 hours; refresh them rather than committing them. The helper prioritises runtime request context and refreshes expired local tokens when Vercel CLI credentials are available. No token is cached by CQA.

Configured authentication does not confirm account credits or provider availability. Verify a real request on the target deployment and inspect Gateway Logs before claiming AI launch readiness. Gateway billing/verification failures may still need account action.

Sources: https://vercel.com/docs/ai-gateway/authentication-and-byok/oidc and https://vercel.com/docs/ai-gateway/sdks-and-apis/openai-chat-completions
