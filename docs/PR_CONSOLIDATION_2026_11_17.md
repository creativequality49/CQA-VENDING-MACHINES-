# CQA PR consolidation — 17 November 2026

User instruction: review all eleven open PRs, merge the fixes still needed, fix failures and push. This authorizes the bounded code-repair release; it does not establish that real customer checkout has passed acceptance.

## Reconciliation

- PR48: retain sandbox/Production separation, compatible dependency patches and proposed visibility repair; reconcile with current main, retaining live catalogue hold and latest homepage.
- PR41: remove implicit CQA database fallbacks with validated explicit configuration. Preserve the verified existing Production backend; do not adopt the old branch's invalid hostname regex or reject Production on assumed brand ownership.
- PR40: adopt full buyer-history pagination and bounded offer batches, preserving verified non-anonymous identity and order/business/machine binding.
- PR36: adopt product-machine binding and positive-byte private storage HEAD checks before Stripe. Missing, zero-sized or failed file checks stop checkout.
- PR34: canonical production email redirects plus isolated Preview-safe redirects. Do not redirect sandbox credentials to Production.
- PR26: adopt contact failure/retry/double-submit protections, accurate return-page wording, comparisons and FAQ in current styling; retain checkout gates.
- PR27/28: superseded by the selected PR26 reconciliation; do not restore unconditional live Stripe links.
- PR35: adopt a catalogue-backed digital-kit preview with enquiry-only CTAs. A configured path is not evidence that a kit can be paid for or delivered.
- PR29: wizard already adopted; supersede stale global styling rather than replacing current design.
- PR39: preserve current mobile layout; do not restore the fixed dock that covers content.

## Verified evidence

- Combined app: 35 local harness stages passed, including regressions, TypeScript, lint and Next production build. Lint: 19 existing warnings, no errors. Evidence was generated against fdcae43 plus the working-tree repair, before the final commit. Hosted CI for the pushed candidate remains separate.
- Production-render smoke: 18/18 checks, six routes at 390/720/1440 pixels; policy pages return 200, no horizontal overflow, dock overlap, page errors or exposed live Stripe links.
- Compile-only public Supabase placeholders are limited to the build child process when real public configuration is absent. They are not app fallbacks or integration-test credentials.
- Explicit Production server/browser Supabase URLs and public publishable-key configuration were inspected through Vercel; the existing Production project is configured explicitly.
- CQA Launch Test database repairs were applied for draft visibility and attached-asset immutability. Identical hosted rollback fixtures improved from 11/19 to 19/19 passing. Zero fixture users/businesses/machines/offers remained. Synthetic SQL identities are not real Auth/browser E2E evidence.
- Current protected Preview health verifies both database URLs and the test acknowledgement; DB access/schema work. Stripe key is invalid; test R2/email/Connect signing configuration is missing. These facts supersede historical403/PAM blockers.
- Correct AUD monthly sandbox prices (97/297/997) were inspected and configured on the candidate Preview branch only. Both launch approvals remain false.

## Still required for paid launch

Correct sandbox key; enabled controlled merchant; protected private test storage; controlled notification delivery; real registration/email-confirmation/save/logout/login/publication; genuine signed sandbox webhook, purchase and entitlement; buyer/owner notification; private download, unsigned denial and second-buyer denial; refund/cancellation and 600-second signed-URL expiry; operational restore/reconciliation drill. Existing provider mocks and hosted SQL fixtures do not replace these.

The dedicated test webhook relay is a separate bounded infrastructure step. It must preserve Preview SSO, validate Stripe signatures, retain credentials privately and forward only to fixed webhook paths; no bypass secret is put in Stripe's endpoint URL.

## Rollback

Revert the consolidation code commit(s) if necessary. Database changes are separate actions and must not be assumed reverted by an app rollback. Checkout holds remain closed until genuine integration evidence passes.
