# Purchase automation deduplication

Prepared 1 November 2026 (Australia/Adelaide). Implemented in draft PR23;
production launch remains NOT_READY.

Recovered and freshly validated on 2 November 2026 before publication.

## Problem and resulting behavior

Different Stripe completion event IDs for the same Checkout Session previously
created separate automation runs. Event-ID replay protection and order uniqueness
did not prevent the repeated aftercare work.

Purchase runs now use a stable UUIDv5 identity derived from business, automation
and Checkout Session. The existing cqa_automation_runs primary key arbitrates
concurrent insertions. A duplicate is accepted only after verifying the exact
business/automation/session tuple. Existing random-ID purchase runs are also
checked so delayed events do not repeat their work. Other checkouts, businesses
and automations remain independent; manual/nonpurchase runs keep their behavior.

Execution claims compare the observed status, step, update timestamp and wait
time. Only one worker can execute a queued/due-waiting snapshot. Durable step,
wait, approval, completion and failure writes are checked; scheduling failures
are surfaced to the payment webhook instead of silently acknowledged.

New purchase rows have a server-owned output version marker. Automatic queued
recovery filters that marker before the batch limit and verifies the stable ID.
Legacy/random queued rows may already have ambiguous external effects and are
left for review. Due waits and eligible new queued work are ordered fairly.

## Validation actually performed

- The original duplicate-run behavior was reproduced before repair.
- 26 behavioral groups passed against actual compiled engine/helper code with
  in-memory database, Resend and HTTP boundaries. Independent Tester and Release
  Auditor ran the final suite successfully.
- Coverage includes sequential and concurrent completions, separate tenants and
  checkouts, partial scheduling failure/retry, unrelated unique errors, legacy
  runs, stale workers, due waits, approval holds, failed state writes, safe queued
  recovery, pre-limit filtering and manual/nonpurchase behavior.
- Stable UUIDs match committed vectors independently calculated with Python's
  UUIDv5 implementation, protecting durable identities across future versions.
- Metadata-only inspection confirmed the existing UUID primary key and required
  JSONB/timestamp/status fields, with RLS enabled. No customer rows were queried.
- An initial full check caught a prefer-const lint error; it was corrected without
  disabling a rule. Final full-harness results are recorded in the PR and state.
- Fresh validation on 2 November: all 22 configured check groups passed, including
  behavioral regressions, TypeScript, lint and the production build. Independent
  Tester and Release Auditor reran all 26 purchase groups; an additional in-memory
  simultaneous-insert case exercised a real mock primary-key collision safely.

These are code/concurrency simulations, not real-provider payment or email
delivery evidence. No customer email, external webhook, payment, migration,
price, security policy, live approval flag or production deployment was changed.

## Failure and recovery guide

| Observed state | Handling |
|---|---|
| Insert failed before a run exists | Payment webhook reports failure; a retry may schedule the missing run. |
| Completed/waiting/approval run exists | Reuse the recorded run; do not repeat its earlier side effects. |
| New marked deterministic run is queued | Scheduler may claim it once and recover execution. |
| Legacy/random queued run | Review prior effects before any explicitly authorised recovery. |
| Running/failed run has uncertain external effects | Preserve evidence and reconcile manually; do not automatically replay. |
| Scope mismatch, lookup failure or invalid marked identity | Fail/report review required; do not create or execute replacement work blindly. |
| Checkpoint/failure recording unavailable | Surface an error; do not report confirmed success. |

## Release and operating limits

This needs no database migration. Keep the UUID namespace/identity version and
existing run records stable. The server marker is recovery metadata, not an
authentication credential. Do not backfill it onto legacy queued jobs to make
them run automatically.

Keep live checkout holds closed during rollout and drain old writers before
opening them; mixed old/new writers are not proven duplicate-safe. Existing
duplicate historical runs are not deleted or repaired automatically. Rolling
back to an old writer can restore duplicate creation, so retain the holds while
reviewing any application rollback.

This does not promise global exactly-once external delivery. A provider may have
completed work before a process crash or database failure; such ambiguous work
requires review. Genuine payment-to-download, storage privacy, expiry/refund and
two-account tests, approved business terms and concrete release approval remain
separate launch requirements.
