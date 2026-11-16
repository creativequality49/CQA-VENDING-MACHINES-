# CQA isolated test webhook receiver

Prepared code only. Provision and deploy **only** to CQA Launch Test,
`ndzmlywsuywkhgqdbzft`, after reviewing the candidate and configuration. This is
not a production webhook, a checkout approval or evidence of fulfilment.

The standalone reviewed SQL input is
`database/cqa_test_webhook_relay_provisioning.sql`. No Supabase CLI was installed
in the preparation workspace, so it is deliberately not assigned a fabricated
migration-history filename. Independently verify the selected database project
before applying it. Vault must exist. Verify the resulting function ACL: PUBLIC,
`anon` and `authenticated` must have no EXECUTE; only `service_role` receives it.
Do not select or print decrypted secret values in reports.

Create/update these named Vault entries through secure provider administration:

- `cqa_test_webhook_preview_origin`: exact immutable isolated CQA Preview origin,
  HTTPS, no trailing slash, credentials, port, path, query or fragment.
- `cqa_test_webhook_bypass_token`: Vercel automation bypass token. Do not put it
  in a Stripe endpoint URL, browser code, source or reports.
- `cqa_test_webhook_platform_signing_secret`: signing secret for the Stripe test
  platform receiver endpoint. Preview `STRIPE_WEBHOOK_SECRET` must match.
- `cqa_test_webhook_connect_signing_secret`: signing secret for the Stripe test
  Connect receiver endpoint. Preview `STRIPE_CONNECT_WEBHOOK_SECRET` must match.

Deploy the handler with **JWT verification disabled for this function only**
(`verify_jwt = false`, as recorded in `supabase/config.toml`). Stripe cannot
supply a Supabase user JWT. The receiver instead requires a valid raw-body
Stripe signature with a timestamp within 300 seconds and a signed event with
`livemode: false`. Default Edge environment
`SUPABASE_URL` must name the exact test project; `SUPABASE_SERVICE_ROLE_KEY` is
used only for the privileged Vault RPC. No service key is forwarded to Vercel.

Stripe test endpoint URLs contain no bypass or signing secret:

- `https://ndzmlywsuywkhgqdbzft.supabase.co/functions/v1/cqa-test-webhook/platform`
- `https://ndzmlywsuywkhgqdbzft.supabase.co/functions/v1/cqa-test-webhook/connect`

The first can forward only to `/api/stripe/webhook`; the second only to
`/api/marketplace/stripe-webhook`, on the configured Preview. Both forward the
original signature and bytes. The bypass is added as an HTTP header, redirects
are refused and outbound requests have bounded timeouts. Caller-supplied
headers and URL controls do not select destinations. Success returns an empty
204; failures return generic text. Receiver requests over 1 MiB are rejected,
including streamed requests without Content-Length.

Keep Preview SSO enabled and all production checkout holds unchanged. After
provisioning, verify anonymous RPC denial, unsigned/stale/tampered/oversized
webhook rejection, genuine Stripe test delivery, duplicate-event application
idempotency and ordinary Preview SSO protection. Unit tests are not genuine
Stripe delivery evidence. Disable test endpoints and revoke the temporary
bypass credential when testing ends.

References:

- https://supabase.com/docs/guides/functions/auth
- https://supabase.com/docs/guides/database/vault
- https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation
