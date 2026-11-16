# Customer launch check — 11 November 2026 (Australia/Adelaide)

Status: **NOT READY for paid-customer launch**. This bounded repair adds the three missing policy routes and prevents mobile shortcut navigation from covering content. It does not enable checkout, apply database changes or certify legal compliance.

## Changes and local evidence

- `/terms`, `/privacy`, `/refund-policy`: shared existing styling, operator identity, approved cancellation/ownership decisions from the existing business draft, consumer rights and provider disclosures. No new refund deadline, delivery guarantee or price/tax change.
- Mobile shortcuts occupy normal flow below the header; no longer a fixed overlay.
- Full repository harness: all 28 stages passed, including regression tests, TypeScript, lint and production build. Lint has 19 existing warnings and no errors. Run observed against baseline `ce6b42dd85d8761a693c9f666704acb7401e4be9` plus this working-tree patch, not an immutable candidate SHA.
- Production build served locally: homepage and all three policy pages returned HTTP 200 at 390, 720 and 1440 pixels. Mobile navigation ends where main content starts; no horizontal overflow. Desktop shortcut dock stays hidden.
- Builder, tester, optimiser and independent release-audit reviews completed. No material blocker found in the bounded policy/mobile patch.

## Customer journey checked publicly

Custom business details and a priced offer appeared in the preview. Business details survived a reload in the same browser; this is browser storage, not authenticated database persistence. Continuing with custom business details opened login with an onboarding return path. Signup and recovery forms loaded, but no controlled inbox/account session was available.

The demonstration request completed with explicit confirmation that it created no live booking and contacted no real business. The membership demo also routes to an enquiry form, so it does not demonstrate paid subscription fulfilment. Live customer checkout remains visibly paused.

## Current provider evidence and blockers

- Vercel maps the public domain to project `cqa-vending-machines`; inspected production deployment matches the baseline Git SHA. Non-decrypting environment metadata listing returns HTTP 403. No locally authenticated Vercel CLI is available. Actual preview isolation cannot be established.
- Existing CQA Launch Test Supabase project reports ACTIVE_HEALTHY, but a fresh `SELECT 1` fails with PostgreSQL PAM authentication error `28000`. This blocks hosted SQL verification; no migration or fixture write was attempted.
- The connected `CQA Isolated Launch Test` Stripe test account returns an empty connected-account list. No merchant was created, no agreement accepted, and no checkout/refund executed.
- Existing integration runner offline preflight is blocked by all 14 required `CQA_TEST_*` variables. No provider requests were made by the runner. Tokens, private storage credentials and controlled fixtures must use secure runtime configuration.
- Open PR48 contains separate commerce isolation/security and proposed RLS repairs. It is not merged into this baseline; this policy repair must not be represented as resolving those launch blockers.

## Remaining acceptance gates

1. Verify an isolated preview's exact deployment SHA and server configuration: CQA Launch Test database, Stripe test mode, private test R2 bucket and controlled email recipients.
2. Restore test database SQL access and inspect required schema/RLS changes. Apply only separately authorised migrations; verify hosted owner/buyer isolation.
3. Complete controlled registration/email confirmation, password login/recovery, saved workspace, logout/login and first publication.
4. Complete merchant onboarding in sandbox, subscription activation, real test purchase and signature-verified webhook; replay events and verify one durable entitlement/order.
5. Verify every supported offer type: buyer confirmation, owner notification and promised fulfilment. Booking-owner alerts depend on configured `new_booking` automation; a source path is not delivery evidence.
6. Verify actual refund and cancellation, second-account denial, private upload/public denial, authorised download and real expiry. Existing signed URLs last 600 seconds; refund blocks new issuance but does not instantly revoke an outstanding URL.
7. Verify operational recovery, including a controlled backup/restore drill and reconciliation of uncertain external automation effects.

Existing fixture/mocked-provider tests cover many failure cases. They do not replace these genuine provider gates. Production policies remain unchanged until this repair is merged/deployed. Keep production checkout holds closed.

## Rollback

Revert this bounded policy/mobile repair; no schema, credential or billing rollback is required.
