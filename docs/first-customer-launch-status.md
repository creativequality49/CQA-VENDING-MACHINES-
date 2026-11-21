# First paid customer: verified status and remaining work

Updated 21 November 2026 (Australia/Adelaide). This report distinguishes a
published interface from a verified commercial transaction.

## Completed

- Customer purchase history, project briefs, owner fulfilment, private handover
  endpoints, buyer scoping and payment-reversal safeguards are implemented.
- Local regressions/build and intercepted customer/owner browser journeys pass.
- Isolated customer-fulfilment schema migration and remote PostgreSQL
  transaction/isolation/refund-denial tests passed, with fixtures rolled back.
- Public storefront styling is reviewed. The CQA Digital Vending Machine artwork
  and interactive concept open real navigation destinations; they do not charge
  customers or imply a physical robot dispenses anything.
- A private owner-review Business Launch Kit draft now contains a 12-page
  fillable workbook, equivalent editable text workbook, five CSV templates and
  instructions. It is not published, approved for sale or uploaded to fulfilment
  storage. Proposed catalogue pricing remains subject to owner review.

## Merchant fulfilment extension

The new candidate adds owner product management, revisioned stock adjustments, stock reservations, paid-product fulfilment jobs, private shipment records, merchant dispatch/tracking and buyer tracking. Marketplace discovery now lists published merchant machines instead of redirecting to AI workers. A shared launch checklist validates each offer before publication.

The PostgreSQL migration and local browser/provider-fixture tests are separate from real Stripe, storage and email proof. The merchant-product migration was applied to the isolated CQA Launch Test database. A transaction-scoped test against its actual schema passed stock, shipping-fee, idempotency, refund and RLS checks; all fixtures were rolled back. Production has not been migrated or released. Physical shipping is merchant-managed; automated carrier labels, warehouse dispatch and autonomous AI stock control are not implemented. See `merchant-product-fulfillment.md`.

The owner selected the Stripe account with matching existing prices. Read-only comparison identified CQA Isolated Launch Test: A$97/A$297/A$997 monthly. No prices or live account were changed.

## Last remote audit evidence

At the audit, production still ran main `a8b7613`; the new customer journey and
styling were on the PR #50 Preview branch. Production customer-fulfilment tables
were absent; isolated tables and migration were present. Production had one
offer, zero active priced offers, zero live priced offers and zero priced
private-asset offers. Stored ready connected merchant records and active/trialing
platform-plan records were both zero. Production pricing visibly kept checkout
paused. Business entitlement and merchant activation must be verified alongside
the actual Stripe account before opening checkout.

Preview health returned 503: invalid/unverified Stripe test configuration,
missing Connect webhook secret and email/sender configuration, and incomplete
isolation acknowledgement/private R2 setup. Production health returned 200 for
configuration, which does not prove payments or delivery.

`vending.cqa.company` serves a separate ChatGPT Sites sign-in wall. It is not the
GitHub/Vercel production application. Choose and verify one intended customer URL
before directing paying customers to it.

## Minimum paid-launch sequence

1. **Fix new-customer email access.** Correct CQA Launch Test Auth Site URL and
   callback allowlist, then verify a fresh real signup/sign-in email and password
   recovery. The confirmed hosted-preview-to-localhost fallback remains unresolved;
   dashboard sign-in was declined. See `email-login-redirect-fix.md`.
2. **Configure the isolated payment path.** Use the selected CQA Isolated Launch Test account and
   configure valid test credentials, Connect webhook secret and transactional
   email sender. Verify the correct merchant/account ownership. Do not reuse live
   provider credentials as isolated test fixtures.
3. **Approve one genuine offer.** Set an agreed price, explicit scope, delivery
   timing, support and refund/cancellation terms, and an actual fulfilment method.
   The new kit is a reviewable draft, not evidence of product-market fit or a
   published offer. One-time service handover can use a message; downloadable
   products require configured private storage and verified files as well.
4. **Prove the complete journey.** Genuine confirmed buyer -> hosted test checkout
   -> signature-verified webhook -> exactly one durable order -> receipt -> buyer
   brief -> owner handover -> entitled customer access -> refund revocation.
   Include a second buyer/owner, failed payment, replay and outsider-denial cases.
   For files, prove a real private upload and download; metadata-only SQL tests
   do not establish object delivery.
5. **Release and verify production.** Apply the reviewed production migration,
   release the tested candidate, verify live merchant charging/payout readiness,
   production authentication/receipt/support and customer terms, then enable the
   approved payment path. Keep checkout held until these checks pass.

Initial focus should be one offer and one verified customer journey. Consumer
recurring billing, shipping, appointment reservation, autonomous AI and all six
separate apps are not prerequisites for a scoped one-time launch; do not sell
those unfinished workflows as operating features.

## Evidence boundaries

The latest interface QA tests navigation and lighting controls only. Local auth,
checkout and browser tests use synthetic/intercepted provider responses where
stated. Remote SQL tests prove database behaviour, not a real Stripe event or
email. No income or sales outcome is established by a successful build.
