# CQA Vending Machines — Acceptance Test Checklist

**Status:** DRAFT  
**Deployment Policy:** `MACHINE_CHECKOUT_ENABLED=false` until full sign-off.

> **Evidence Standard:** Every checked item requires verifiable evidence (database row state, object storage key, or sent email log). A Netlify HTTP `202` response alone does NOT constitute proof of completed fulfillment.

---

## Section A: Environment & Identity Verification
- [ ] **Supabase Target Verified:** Target project confirmed as dedicated CQA database (Project ID explicitly confirmed; `fanxfantasy` ruled out or migrated).
- [ ] **Netlify Server-Only Variables Configured:**
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `STRIPE_SECRET_KEY`
  - [ ] `STRIPE_WEBHOOK_SECRET`
  - [ ] `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME`
  - [ ] `RESEND_API_KEY`
  - [ ] `OPENAI_API_KEY`
  - [ ] `WORKER_SECRET`
  - [ ] `MACHINE_CHECKOUT_ENABLED=false`
- [ ] **HTTPS Domain Check:** Netlify site URL enforces HTTPS (`https://creativequalityausvendingmachines.netlify.app` or custom domain).
- [ ] **Secrets Audit:** Local `.env.local` sanitized (contains `OPENAI_API_KEY` only); no secrets printed in build logs or committed to Git.

---

## Section B: Payment & Webhook Integrity
- [ ] **Webhook Idempotency:** Duplicate `checkout.session.completed` events (re-sent with identical Stripe Event ID) process exactly once.
- [ ] **Unpaid Session Handling:** Webhook payloads with `payment_status != 'paid'` reject fulfillment queueing.
- [ ] **Amount Verification:** System verifies payment amount against expected price in server configuration before queuing jobs.
- [ ] **Signature Verification:** Requests missing or failing Stripe signature validation return `400 Bad Request`.
- [ ] **Dispute / Refund Revocation:** Refunded or disputed transactions automatically disable deliverable download URLs and block ongoing worker generation.

---

## Section C: Intake & Job Lifecycle
- [ ] **Worker Call Authentication:** Background job endpoints reject calls lacking the valid server-only `WORKER_SECRET` header.
- [ ] **Atomic Execution Claims:** Simultaneous worker invocations on the same job result in exactly one successful lock (using `FOR UPDATE SKIP LOCKED`).
- [ ] **Stale Lease Recovery:** Jobs stuck in `running` or `claimed` state past the timeout threshold are safely released or flagged for retry.
- [ ] **Audit Logs:** State transitions (`queued` → `claimed` → `running` → `qa` → `published` / `failed`) are logged with accurate timestamps.

---

## Section D: Generation & QA (AI Content)
- [ ] **Provider Timeouts & Retries:** OpenAI API integration enforces strict timeout boundaries and backoff logic.
- [ ] **Runtime Schema Validation:** Generated outputs are strictly validated against runtime JSON schemas before entering the published state.
- [ ] **Bounded Revisions:** Failed QA validation triggers bounded retry counts before marking the job as failed and alerting operators.
- [ ] **Customer Output Quality:** Human readability and formatting audit completed on sample outputs.

---

## Section E: Storage & Access Security
- [ ] **Private Storage Enforcement:** Output files stored in Cloudflare R2 bucket are non-public; direct URLs return `403 Forbidden`.
- [ ] **Signed Download Links:** Download links expire after a short, configured window.
- [ ] **Tenant Isolation:** Users cannot request or access deliverables belonging to another customer ID or order ID.
- [ ] **Prototype Pollution Fix:** Product lookup logic strictly rejects inherited properties like `constructor` and `__proto__`.

---

## Section F: Notifications & Outbox
- [ ] **Durable Outbox Pattern:** Emails are written to a notification queue/outbox table and delivered asynchronously.
- [ ] **Delivery Retries:** Resend provider errors trigger exponential backoff retries without blocking or failing the main generation job.
- [ ] **Verified Sender Domain:** All customer notification emails originate from a verified domain with valid SPF/DKIM records.

---

## Section G: End-to-End Evidence Record

| Date | Stripe Event ID | Order ID | Job ID | R2 Key / Output | Email ID | Verified By |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| | | | | | | |

---

## Section H: Production Sign-Off
- [ ] All checks in Sections A–F verified with attached logs/database snapshots.
- [ ] `MACHINE_CHECKOUT_ENABLED` set to `true` **for AI Content only**.
- [ ] Lead Capture, Sales Follow-Up, and Business Automation remain disabled until independent verification.

**Sign-off Signature:** ___________________________  
**Date:** ___________________________
