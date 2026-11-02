# Genuine marketplace verification runner

Prepared 2 November 2026. This adds an executable verification path to the
existing application. It does not mark customer launch ready, enable checkout,
create fixtures, make payments, refund money, run migrations or change policies.

## What it can verify

`node scripts/verify-marketplace-integration.mjs` performs an **offline preflight**.
It reports missing variable names, invalid origins and fixture scope without
calling a provider. Preflight success is configuration presence, not a passed
integration test. Missing prerequisites exit 2; failed probes exit 1.

`--verify-read-only` uses the real Supabase Auth service to validate a confirmed
owner and two buyers, requires all three returned user IDs to differ, then calls
the existing owner attachment picker, buyer libraries and download endpoints.
It checks buyer A's controlled order appears once and buyer B cannot see/download
it, anonymous download is denied, the signed object has the exact fixture SHA256,
and an unsigned request to that selected S3 object returns 403. It follows no
redirects and never sends bearer credentials to R2.

Unsigned S3 denial does **not** prove the bucket has no r2.dev or custom-domain
public access. Independently inspect Cloudflare bucket public settings and probe
every configured public origin. The report leaves bucket-public-configuration,
actual upload persistence, signup, payments, webhook/durable entitlement,
refund/cancellation and business terms UNVERIFIED.

The runner does not create or upload a fixture. An app preview hostname alone
cannot prove its server configuration is isolated from production. Before any
probe, including read-only requests that send test tokens, inspect the actual
preview's environment mapping and independently bind its owning team, deployment
ID and Git SHA to the intended candidate. A matching hostname is insufficient.

## Isolated prerequisites

Use the existing **CQA Launch Test** Supabase project
`ndzmlywsuywkhgqdbzft`; this runner refuses the production project. Verify the
server's `SUPABASE_URL` **and** `NEXT_PUBLIC_SUPABASE_URL` resolve to that test
project (the admin helper otherwise has a production default), and that all
server service-role credentials match it. Configure actual test Stripe/Connect
credentials and a separate private R2 test bucket with narrowly scoped access.
Keep production launch flags closed. Never reuse production credentials or
customer accounts/records for these fixtures.

For genuine checkout, the controlled merchant requires an entitled plan, a
published business/machine/offer and the matching test Connect account with
`charges_enabled`, `details_submitted` and correct `cqaBusinessId` metadata.
The owner attaches a new controlled file using the actual owner upload page;
verify refresh persistence and public denial. Use confirmed test accounts, a
notification sink and configured Resend test delivery: webhook email failure can
return 500 after a paid order was recorded. Do not route test notifications to
customers. Do not bypass RLS, migrate/seed automatically, simulate payment by
writing an order row, or simulate refund by directly changing database status.

Complete an actual Stripe sandbox Checkout payment and signature-verified
webhook to obtain buyer A's fixture order, then perform real refund/cancellation
through approved sandbox operations. The read-only runner validates the resulting
download path but cannot certify how that order became paid. Preserve the Stripe
test event/session and exact candidate reference in a sanitised separate test
report. Do not treat mocked tests or direct DB fixtures as payment evidence.

## Secure configuration

Supply variables through the authorised runtime secret mechanism; never paste
values in chat, source, shell arguments, PRs or reports. This script does not load
or print environment files. Required names:

- `CQA_TEST_BASE_URL`: the exact HTTPS `cqa-vending-machines-*-creativequality.vercel.app` preview
  origin. Custom domains, localhost and the production alias are refused.
- `CQA_TEST_SUPABASE_URL`: the fixed test project's HTTPS origin.
- `CQA_TEST_ISOLATION_ACK`: exactly the test project reference, after actual
  server-side environment isolation was independently verified.
- `CQA_TEST_CANDIDATE_SHA`: the expected 40-character Git SHA. Its deployment
  binding must be independently checked; a supplied SHA is not proof.
- `CQA_TEST_SUPABASE_ANON_KEY`: publishable/anon key; service-role keys refused.
- `CQA_TEST_OWNER_TOKEN`, `CQA_TEST_BUYER_A_TOKEN`, `CQA_TEST_BUYER_B_TOKEN`:
  short-lived access tokens for the controlled, confirmed test accounts.
- `CQA_TEST_R2_ACCOUNT_ID`, `CQA_TEST_R2_BUCKET`: the exact isolated storage scope.
- `CQA_TEST_BUSINESS_ID`, `CQA_TEST_OFFER_ID`, `CQA_TEST_ORDER_ID`: controlled
  fixture UUIDs, supplied privately rather than included in public output.
- `CQA_TEST_ASSET_SHA256`: digest of the original controlled file.

Reports print statuses, check codes and the configured candidate SHA only. They
omit account identities, product titles, fixture IDs, signed URLs, credentials
and raw errors/provider bodies. The selected object is bounded to 4 MiB.

## Real expiry recheck

After a successful signed download, the runner creates a mode-0700 temporary
directory and mode-0600 `expiry.json`. This **restricted local state contains the
signed URL** so the *same previously working URL* can be tested after expiry.
Only its local path appears in the sanitised report; never upload or commit the
private state file, and remove its temporary directory after testing. The runner
resolves the temporary root and refuses a `TMPDIR` inside this repository,
including a symlink to it, so the signed URL cannot be written into the checkout.

The signed lifetime remains the application's real 600 seconds. No test clock
changes, short-lived substitute URLs or blocking waits are used. After the
reported `recheckAfter` time, run:

```sh
node scripts/verify-marketplace-integration.mjs --verify-expiry --state-file /tmp/cqa-integration-REPLACE/expiry.json
```

Keep the non-secret scope/candidate variables configured; expiry mode does not
need buyer tokens or the publishable key. It validates ownership, permissions,
scope, signature metadata and candidate binding of the restricted state before
requesting the original URL. A pre-expiry run stays pending; a network error is
blocked; only HTTP 403 after the actual lifetime passes this narrow denial probe.
This does not prove immediate outstanding-URL revocation on refund: an already
issued URL retains its original lifetime. A separate real refund test must check
new-download denial and observe the outstanding URL window explicitly.

## Local runner checks

`node tests/marketplace-integration-runner-check.mjs` exercises the driver with
mocked external providers, including wrong origins/projects, distinct live
identities, auth failure, digest mismatch, isolation leakage, URL redaction,
403 versus network failure, same-URL expiry and protected state permissions.
These are **runner behavioural tests**, not genuine provider results.

Primary auth reference:
https://supabase.com/docs/reference/javascript/auth-getuser — `getUser(jwt)`
performs a network request to Auth; decoded JWT fields alone are not trusted for
authorisation. No server auth or RLS implementation is changed by this runner.

## Access and business findings — 2 November 2026

- Native Vercel deployment reads work, but a non-decrypting environment metadata
  request for the CQA project still returns HTTP 403. No Vercel CLI is installed.
  Environment-variable permissions are distinct from deployment permissions;
  inspect the integration's environment-variable scope and the user's project
  role. Team reconsent is not a proven fix for this denial, and readable metadata
  would not make write-only secrets available to the local runner.
- The existing CQA Launch Test project is ACTIVE_HEALTHY. A schema-only query
  confirmed `cqa_orders.buyer_user_id` is UUID. No customer rows were queried,
  fixtures created or migrations run in this iteration.
- Stripe currently exposes only the live CQA account. A sandbox must be added
  to the connection separately; live credentials cannot be used for these tests.
- Read-only live Stripe inspection found an active AU tax registration and
  active tax settings with default `tax_behavior=inferred_by_currency`.
  All ten existing automation catalogue links remain active; every link has
  `automatic_tax.enabled=false` and its prices have `tax_behavior=unspecified`.
  Stripe's currency-inferred default maps AUD to inclusive treatment when
  Stripe Tax is used, but it does not prove tax collection on these links or
  legal GST registration. The legal operator/ABN and approved GST treatment of
  the advertised prices still require confirmation. No price or tax setting
  was changed.

For the fastest isolated setup, an authorised owner can configure **Preview**
overrides restricted to `fix/production-revenue-readiness-20261028` in the
[existing CQA project's environment settings](https://vercel.com/creativequality/cqa-vending-machines/settings/environment-variables).
Use the test project's URLs/keys for `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`; sandbox values for
`STRIPE_SECRET_KEY` and `STRIPE_CONNECT_WEBHOOK_SECRET`; test-only values for
`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `R2_BUCKET`; and
controlled notification settings for `RESEND_API_KEY` and `CQA_EMAIL_FROM` (or
`CQA_AUTOMATION_FROM_EMAIL`). Keep production unchanged and launch holds closed.
Inspect the resulting preview's actual configuration before any fixture write.
New environment settings require a new preview build; a prior preview does not
acquire them retroactively. This iteration did not configure or deploy one.

Brooke's reviewable commercial draft remains
[PR26: CQA business terms](https://github.com/creativequality49/CQA-VENDING-MACHINES-/blob/astra/improve-automations/docs/CQA_BUSINESS_TERMS_DRAFT.md).
It proposes a written scope/delivery date per customer, cancellation at the end
of the paid period, an appropriate unused-setup-work refund, agreed bespoke
deliverables after payment, and explicit provider/retention disclosures. These
are proposals, not approved or published terms. Confirm the legal name/ABN,
GST treatment, cancellation/refund and ownership choices, plus actual privacy
contacts, recipients and retention. Reconcile overlapping PR26/PR27 changes and
obtain approval for one exact release after genuine integration evidence passes.

References for the access/tax interpretation:
- https://vercel.com/docs/integrations/create-integration/vercel-api-integrations
- https://vercel.com/docs/integrations/install-an-integration/manage-integrations-reference
- https://vercel.com/docs/environment-variables
- https://docs.stripe.com/tax/products-prices-tax-codes-tax-behavior
- https://abr.business.gov.au/
