# Customer testing — 19 November 2026 (Australia/Adelaide)

Candidate application: `4c30bc097b54a87c1fd554de1653ac233c5556d7`.
Scope: existing CQA Vending Machines / Machine Market repository. This does not
certify the six separate Sites applications or authorize live customer charges.

## Completed evidence

- User approved proceeding with isolated testing. Applied the committed
  `20261117113349_customer_fulfillment.sql` migration to **CQA Launch Test**
  (`ndzmlywsuywkhgqdbzft`). Production was not migrated.
- Verified new workspace/event tables, purchase snapshot column, indexes,
  owner-scoped read policies and RLS. Anonymous roles have no table access;
  browser roles cannot mutate fulfilment. Transition function is SECURITY
  INVOKER, has an empty search path and is executable only by service_role.
- Executed `tests/fixtures/customer-fulfillment-remote-rollback.sql` on the
  isolated remote PostgreSQL database. Paid intake/start/asset-metadata/delivery,
  revision conflicts, buyer/owner isolation, owner-only RLS, browser function/write
  denial, refund rejection and retained purchase identity passed. The transaction
  rolled back; zero fixture users/businesses remained. Asset metadata is not
  evidence of an uploaded storage object.
- Actual anonymous Data API requests to both new tables returned HTTP 401.
- Actual unsigned-in deployed requests to customer order list/detail and owner
  order list returned HTTP 401.
- Latest complete local run on the application candidate passed all 46 checks,
  including TypeScript, lint, production build, SQL transition/RLS checks,
  buyer isolation, webhook replay and refund regression scripts.
- Desktop/mobile intercepted browser journeys passed customer intake, owner
  start/delivery, customer handover refresh and sign-out without page errors.
- Both GitHub workflows and both Vercel deployments for the candidate succeeded.

Local/provider-mocked tests and synthetic database fixtures do not prove genuine
Auth signup, email delivery, a Stripe payment, or persistent private storage.

## External acceptance still blocked

- Select the Stripe sandbox account. The connected account inventory contains
  multiple sandboxes; CQA Isolated Launch Test matches the prepared setup.
- Configure a valid isolated Stripe test API key and Connect webhook secret for
  the candidate preview, transactional email/provider sender and a separate
  private R2 bucket with access credentials. Sensitive Vercel variables cannot
  be read back through the connector; the missing credentials cannot be
  reconstructed from their environment-variable metadata.
- Prepare genuine confirmed owner/buyer test sessions and a test offer/order
  fixture, with independently verified deployment SHA and isolation settings.
  The real integration runner currently exits `blocked: missing-configuration`.
- Then execute actual signup/confirmation, hosted checkout, signature-verified
  webhook, durable order/entitlement, receipt, owner handover, permitted download,
  outsider denial, webhook retry and refund revocation.

Preview health returns HTTP 503 because commerce configuration is incomplete.
Production health returns HTTP 200/configuration-ready, which is not proof of a
working purchase. Fresh production catalogue aggregate: one total offer,
zero active priced offers, zero live priced offers. No customer sale can be
fulfilled until a real offer and its deliverable are published and verified.

## Remaining product and security scope

New consumer subscriptions and physical/shipping offers stay enquiries. Service
checkout does not reserve appointments. Historical customer billing management
and platform owner subscriptions are separate existing paths. Real AI, email,
private storage and external FanX age-assurance behaviour are not certified here.

Dependency audit: 19 total advisories (nine high, ten moderate, no critical).
Production-only audit: six moderate, no high/critical. The Supabase security
advisor also reports existing database-function exposure/auth hardening warnings;
no new fulfilment-table/function warning was reported. These remain follow-ups,
not evidence of a clean security audit.

Existing Supabase advisory references:

- [Anonymous-callable privileged functions](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
- [Authenticated-callable privileged functions](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [Leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
