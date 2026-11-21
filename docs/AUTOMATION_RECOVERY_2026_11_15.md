# Automation workspace recovery — 15 November 2026

This bounded repair recovers the owner automation workspace after interrupted
session, network, response parsing and shared-context requests. Controls settle
after failures, drafts survive uncertain saves, and reloading only reads data.
Saved context is displayed so owners can check before retrying a write. Logged-out
actions do not send writes. Database read errors return an error instead of a
successful empty workspace.

Focused regressions exercise the real transpiled page and GET handler, covering
rejected requests, unsuccessful reads, pending controls, retry recovery,
context rendering and absent sessions. The repository check runner discovers
both new `*-check.mjs` files automatically.

The existing launch holds are unchanged. The isolated CQA Launch Test database
accepted `SELECT 1` during this session, resolving the previously observed basic
SQL connectivity failure for that check only. No migration was applied and no
schema, RLS or customer isolation acceptance is established by it.

The integration runner's offline preflight remains blocked by missing
`CQA_TEST_*` configuration, including the independently verified isolated preview,
private storage scope and controlled owner/buyer fixtures. Full registration,
payment, signed webhook, entitlement, delivery, refund, cancellation and expiry
acceptance remains outstanding. No real payment, account agreement or production
database change was performed.

Rollback: revert this repair; no schema, credential or billing rollback is needed.
