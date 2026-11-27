# CallHand integration (draft)

Vendored independent service in `work/callhand`, excluded from CQA Next.js compilation. Use a separate Supabase project and separate Node WebSocket host. Never apply its migrations to CQA commerce. Apply both migrations in order to an isolated CallHand database. Activation is operator-only after readiness, subscription and privacy review; existing settings UI cannot toggle enabled after migration and needs adaptation before launch. Do not expose the service publicly until provisioning and billing enforcement are implemented. No production deploy or commerce changes.

CQA owner route `/owner/receptionist` checks the existing owner API before showing service status. No cross-project SSO or entitlement provisioning is implemented yet. Run `npm ci`, `npm run typecheck`, `npm test`, `npm run test:db`, `npm run build` from work/callhand. Run CQA checks separately. Live Twilio, retention, billing, activation and cross-project identity remain release blockers.
