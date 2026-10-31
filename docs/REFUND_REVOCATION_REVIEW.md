# Paid delivery: migration and refund review

Reviewed 31 October 2026. Status: NOT READY for paying customers.

## Completed production schema prerequisite

Brooke explicitly authorised the prepared buyer-account change. The exact SQL
from PR23 commit 3305814321d5a5ad937b2444970cd7dd4b6333d4,
database/cqa_marketplace_buyer_entitlements.sql (blob
e35d0f1cfd103291b79602bedab9d7567d41fa22), was applied to the existing CQA
backend as migration 20261031000149, cqa_marketplace_buyer_entitlements.
Application used a 5-second lock timeout and 30-second statement timeout.

Metadata-only postchecks verified the nullable UUID buyer_user_id, validated
auth.users(id) foreign key with ON DELETE SET NULL, and valid/ready paid-order
index. Existing RLS, policy definitions and table grants were unchanged.
Existing email-only orders were not backfilled. No customer rows were queried.
The security advisor reported the same pre-existing notices after application.
This schema prerequisite does not prove any customer payment or account journey.

## Bounded repair

A real route-level regression reproduced a full refund followed by a distinct,
delayed checkout completion restoring paid access. The webhook now creates a
pending order without replacing existing rows, verifies the current payment and
charge in the connected account, and conditionally writes paid access without
overwriting refunded or cancelled states. A concurrent refund wins that write.
Disputes use the deployed schema's cancelled status; they are not represented as
a completed financial refund. Checkout expiry only changes pending orders.

Subscription sessions resolve their original Checkout invoice, validate its
customer/subscription/currency/total and paid status, and inspect its payment.
They do not use subscription.latest_invoice, which can refer to a later renewal.
The implementation preserves the existing Stripe16/API2024-06-20 integration.

## Actual validation

- All 19 configured cross-checkout harness groups passed, including regressions,
  TypeScript, lint and production build. Existing lint warnings remain.
- 27 actual-handler webhook behavioural groups passed with mocked providers.
  These include refund-before-completion, distinct replay after refund/dispute,
  an interleaved revocation, provider/database/receipt failures and original
  subscription-invoice handling.
- Independent tester ran those 27 groups, 11 delivery cases and four extra
  adversarial replay/failure executions. Independent release review found no
  material blocker to publishing this bounded repair as a draft.
- Five production public-health probes passed. They establish route/configuration
  reachability only; they do not prove private storage, payment or fulfilment.
- git diff --check passed. No checkout hold, pricing or access policy changed.

## Still unverified or blocked

1. Genuine payment-to-library/download, refund, expiry and two-account isolation
   have not been run against providers. Execution runtime has no Supabase server,
   Stripe/webhook or R2 credentials. Vercel environment metadata access returned
   403 and no Vercel CLI is installed. Never paste credentials into this report.
2. Connected Stripe access exposes only the CQA sandbox. Its one test Payment
   Link uses hosted_confirmation. That says nothing about the ten live offer
   links or their post-payment handoff; live-account read access is required.
3. Existing R2 signed URLs are bearer capabilities with a 600-second lifetime.
   Refund stops new issuance, but an already issued URL remains valid until
   expiry. Immediate revocation of outstanding URLs is not implemented.
4. Different completion event IDs can still trigger duplicate purchase-automation
   runs. Order uniqueness and receipt idempotency do not prove every side effect
   is exactly once. This remains a separate bounded follow-up.
5. Digital checkout remains intentionally held until real integration evidence
   passes. Do not bypass the production hold to obtain a sale or a test result.
6. Genuine provider tests need an isolated test merchant, private test storage,
   confirmed owner and two buyer accounts, signature-verified webhook delivery,
   and controlled notification recipients/sink. Existing webhook side effects
   must not send test mail to customers.
7. Business confirmation is still missing for GST treatment, service scope and
   delivery dates, ownership/licensing/offboarding, cancellation/refund and
   privacy terms. No business registration or commercial promise was invented.

Production merge/promotion is not part of this repair. Keep the release status
NOT_READY until the final candidate has genuine end-to-end evidence and the
concrete release is approved. Roll back application code if necessary; retain
the additive buyer field/index rather than destroying buyer bindings.
