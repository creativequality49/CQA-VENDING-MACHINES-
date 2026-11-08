# CQA commerce launch verification — 8 November 2026

**Release decision: BLOCKED. Do not enable live checkout or merge this commerce candidate into Production.**

Source base: `c07a88e00326b930bc933bc554f0d245130a1fbc`.
Candidate commit and actual Preview URL are recorded in the pull request, avoiding a self-referential commit identifier here.

## Changes prepared and tested locally

- Test Stripe credentials no longer bypass launch holds in Production, Development, or unknown environments.
- Sandbox checkout requires Vercel Preview, both explicit Supabase URLs pointing to `ndzmlywsuywkhgqdbzft`, and matching `CQA_COMMERCE_TEST_PROJECT` acknowledgement.
- Live-key checkout requires Vercel Production and explicit release approval; digital checkout requires its separate approval too. Existing signed-webhook handling and billing portal remain outside this new-checkout gate.
- Restored the homepage walkthrough link and clear payment-hold notice, fixing the failing acquisition regression while retaining the requested artwork and pink heading.
- Patched Next.js and its ESLint config to 15.5.29, next-auth to 4.24.15, and the Auth Prisma adapter to 2.11.3 (nested Auth core 0.41.3); refreshed compatible transitive dependencies and the lockfile. No forced major upgrade.
- Prepared an unapplied database migration to restrict authenticated non-owners to published offers and machines. Production policy/data changes were not performed.

## Results

| Requirement | Result | Evidence |
|---|---|---|
| Isolated commerce Preview | BLOCKED | Candidate build can be reviewed, but environment isolation cannot be certified while Vercel denies environment access. Design Previews are not commerce-test evidence. |
| Genuine Stripe checkout | BLOCKED | Isolated sandbox account is accessible; no connected merchant or matching webhook endpoint existed during inspection. No simulated or real payment was made. |
| Signed webhook | BLOCKED | Behavioural tests pass with mocked providers; no Stripe-delivered signed event was received. |
| Paid order | BLOCKED | No authenticated controlled buyer purchase or real webhook order exists from this run. |
| Buyer library | BLOCKED | Buyer-bound library behaviour passes unit tests; no genuine paid fixture was verified. |
| Private download | BLOCKED | No confirmed isolated R2 configuration, private upload, or signed-file download from a real purchase. |
| Buyer B / owner isolation | BLOCKED | Unit cases pass, but separate authenticated hosted fixtures were not available. Existing authenticated draft-offer visibility policy needs the prepared repair and validation. |
| Refund revocation | BLOCKED | Terminal-state behaviour passes unit tests; no genuine sandbox refund and resulting webhook transition was observed. Previously issued signed links have a 600-second lifetime; refund revokes new links, not bytes already downloaded. |
| Local automated checks | PASS | 21 check scripts, 16 node test cases, TypeScript, ESLint and Next production build passed. Lint retains 19 warnings and zero errors. Launch matrix checks both gates across 221 cases; digital-checkout tests include 18 behavioural groups. Providers are mocked in these tests. |
| Production release readiness | BLOCKED | Genuine provider flows, hosted policy repair validation and lower-severity dependency findings remain unresolved. |

## External access evidence

- Vercel project: `prj_mXlAYQWxHal1FtpmkNmeVhQco2DB`, team `team_H8frtkB9tgG0pH7xSR4Ann03`. Environment listing returned HTTP 403. There was no installed authenticated Vercel CLI, injected Vercel token, or standard CLI authentication file available for fallback.
- Supabase test project: `ndzmlywsuywkhgqdbzft` (CQA Launch Test). Project metadata reports ACTIVE_HEALTHY, but a harmless SQL query failed with `FATAL: 28000: PAM authentication failed for user postgres`. Health metadata is not evidence of usable database access.
- Stripe sandbox: `acct_1UPzM6P6kjGSpjgk` (CQA Isolated Launch Test), livemode false. Connected-account and webhook-endpoint list responses were both empty. Production Stripe was not modified.
- Existing Supabase project `rjxiuukphwybujuclenn` was inspected read-only for schema/policies, without reading customer rows. RLS is enabled on the five commerce tables checked; the buyer_user_id column exists. This does not certify that the deployed Vercel environment targets this project.
- The existing authenticated offer SELECT policy allows `active OR owner`, unlike the stricter anonymous policy. An authenticated user can therefore read active offers of unpublished businesses. The prepared migration aligns non-owner visibility with both live parents and matching business ownership. This metadata finding does not prove a data breach or a successful private-file download.
- Supabase security advisors returned one INFO and three WARN findings, including disabled leaked-password protection and executable privileged functions. They remain review items; no authentication setting was changed.
- The requested variable name `STRIPE_sk_test_` has no source-code references in app/lib/components/scripts. Environment access was denied, so its existence/value/use cannot be verified. It was not removed, and Production credentials were not read or replaced.

## Dependency audit

Before: 33 findings (4 critical, 12 high, 13 moderate, 4 low).
After compatible repairs: 22 findings (0 critical, 8 high, 11 moderate, 3 low).
These counts concern this candidate dependency tree, not a Production vulnerability exploitation assessment. Remaining dependency findings need triage; do not claim a clean audit.

Primary references: [Auth.js advisory](https://github.com/advisories/GHSA-7rqj-j65f-68wh), [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security).

## What was deliberately not claimed

The existing `scripts/verify-marketplace-integration.mjs` was run and returned `blocked / missing-configuration`. Its read-only and expiry probes cannot, by themselves, prove checkout, webhook or refund success. No synthetic webhook, redirect, mock, build result or empty health advisory was counted as genuine payment-to-delivery proof.

No live billing change, checkout approval, Production deployment, Production migration, credential deletion, or customer-data copying was performed in this run. This draft PR is not release-ready.
