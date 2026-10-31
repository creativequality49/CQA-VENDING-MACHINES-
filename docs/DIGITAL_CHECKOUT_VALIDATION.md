# Authenticated digital checkout and buyer-library validation

Reviewed 31 October 2026. Current status: NOT READY for paying customers.

## Implemented in this bounded repair

- Digital checkout can exercise the existing delivery bridge with sandbox
  credentials. Live digital checkout additionally requires the separate
  server-only CQA_DIGITAL_DELIVERY_APPROVED=true and the existing global
  CQA_CUSTOMER_LAUNCH_APPROVED=true. Neither approval was set by this repair.
- Digital purchases require a Supabase-verified, confirmed buyer account. The
  verified account ID goes into server-created Stripe metadata, and its verified
  email is prefilled. A supplied mismatched email fails before checkout.
- The requested slug/offer and database business/machine/offer must agree. The
  attached private key must be tenant/offer scoped with valid size/type metadata.
  A server-side R2 HEAD confirms the object size and type before Stripe creates
  a session. A missing, changed or unavailable object cannot proceed to payment.
- Storefront controls send the current account bearer token, prevent duplicate
  submission and provide a safe sign-in return route. Existing guest service and
  subscription checkout behavior, prices, fees and Connect account scoping remain.
- The success page says payment confirmation is pending and links to the buyer
  library. Opening a success URL never grants or proves payment.
- Library loads and download navigation use abort controllers and generation
  checks. A response from a former account, stale refresh or unmounted component
  cannot restore product titles or navigate to an old account's download.
- Existing refund replay protection and the 600-second signed URL lifetime are
  preserved. No live billing, price, RLS or storage policy was changed.

## Actual checks

All 21 configured cross-checkout check groups passed, including regression
scripts, TypeScript, lint and production build. The final frozen source was
checked again after recovering the interrupted publication. Existing lint
warnings remain; no errors were suppressed.

Behavioural coverage executes actual compiled handlers/components with mocked
external providers: 14 digital-checkout groups, seven library session/race
groups, 27 refund/webhook groups, 30 upload groups and 11 delivery cases.
Independent Tester and Release Auditor reviewed the bounded checkout/library
repair and executed its digital/library cases before publication. This proves
local code behavior, not actual Stripe, Supabase Auth or R2 integration.

The digital gate matrix covers sandbox keys; live keys with neither, one or both
release approvals; missing credentials; mandatory verified buyer identity;
tenant/machine/offer/key mismatch; invalid metadata (including inherited MIME
property names); HEAD mismatch/failure; unchanged amounts/account/fee metadata;
legacy guest service/subscription flow; duplicate clicks, auth recovery and
hostile redirect URLs. Real object availability is not bucket-privacy evidence.

## Completed database prerequisites

Brooke authorised the prepared buyer-account migration. Production migration
20261031000149 added the nullable buyer UUID, validated auth.users(id) FK and
valid paid-order index with unchanged RLS/policies/grants. Existing orders were
not backfilled and no customer rows were queried.

The existing CQA Launch Test project was restored under its verified Free-plan
organization and became ACTIVE_HEALTHY. Its existing CQA schema was inspected.
The same approved buyer migration was applied there as 20261031001439; metadata
confirmed the buyer column/FK and unchanged access controls. No paid plan or new
project was started.

## Exact remaining integration dependencies

1. Secure isolated runtime configuration: NEXT_PUBLIC_SUPABASE_URL,
   NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY
   (sandbox), STRIPE_CONNECT_WEBHOOK_SECRET, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
   R2_SECRET_ACCESS_KEY and R2_BUCKET. The execution shell currently has none.
   Configure these through authorised secret management; do not paste values
   into chat, code, PRs, reports or logs.
2. Vercel denied project environment metadata with 403; no installed CLI fallback
   exists. R2 privacy, unsigned public denial, real upload persistence and actual
   signed download/expiry cannot be certified from source or a mocked HEAD.
3. Connected Stripe tools expose only the CQA sandbox account. Live Payment Link
   redirect/notification configuration requires live-account read access. Keep
   all existing live offer links/prices/settings unchanged pending verification.
4. Use an isolated sandbox merchant, confirmed owner plus two buyers, controlled
   test files and a notification sink. Test purchase, signature-verified webhook,
   one durable paid entitlement, library/download, URL expiry, full refund and
   both new-download denial and the residual lifetime of already issued URLs.
   Verify the second account cannot read or download the first account's order.
5. Genuine tests have NOT run. Webhooks can send email/trigger automations, so
   never run fixtures with customer addresses or production notification routes.
6. Already issued signed URLs retain their 600-second validity after refund.
   Immediate outstanding-URL revocation is not implemented. Distinct completion
   event IDs may still repeat purchase automation side effects; receipt and order
   idempotency do not prove every automation runs exactly once.
7. GST and approved service/ownership/cancellation/refund/privacy terms remain
   required. A reviewable, unpublished draft is in PR26 at
   docs/CQA_BUSINESS_TERMS_DRAFT.md. It does not assert registration or approval.

Keep all live holds closed until genuine final-candidate evidence passes and
Brooke approves the concrete production release. Rollback is application-code
reversion; preserve the additive buyer database column and existing bindings.
