# CQA Vending Machines — Hands-Free Operations

## Operating objective

Creative Quality Australia should run as an exception-managed platform. Routine billing, access, scheduled releases, delivery and customer self-service are automated. Coworkers handle review queues and exceptions. Brooke remains the owner and final approver for pricing, brand direction, refunds above the approval threshold and major releases.

## Automation ownership

| Workflow | System of record | Automated action | Human escalation |
| --- | --- | --- | --- |
| New purchase | Stripe + Supabase | Verify webhook, create entitlement, unlock vault | Failed payment or missing entitlement |
| Monthly subscription | Stripe Billing | Renew, retry failed payment, update entitlement | Payment remains failed after Stripe retries |
| Cancellation | Stripe Customer Portal + webhook | Cancel access at the configured period boundary | Charge dispute or manual exception |
| Scheduled content drop | Supabase `content_drops` + Vercel Cron | Release due drops daily | Missing asset, invalid schedule or failed cron |
| Digital delivery | Secure signed download endpoint | Generate time-limited download access | Missing object or repeated failed download |
| Customer receipt | Stripe/Resend | Send confirmation and delivery notice | Email hard bounce or delivery complaint |
| Product publishing | Admin approval queue | Publish only approved content | Brand, legal or quality rejection |
| Monitoring | Vercel, Stripe and Supabase logs | Surface failed jobs and webhook errors | Assigned operations coworker investigates |

## Coworker structure

### 1. Operations Coordinator

**Primary outcome:** Keep the platform running without owner intervention.

Responsibilities:
- Check the operations dashboard and failed automation queue each business day.
- Resolve missing entitlements, failed scheduled drops and delivery exceptions.
- Confirm Stripe webhooks and Vercel Cron remain healthy.
- Escalate only exceptions that meet the owner approval rules.

Access:
- CQA admin dashboard
- Read-only Stripe access, with refund permission only when explicitly granted
- Vercel deployment and log access
- Supabase operational access without unrestricted service-role key sharing

### 2. Content and Product Manager

**Primary outcome:** Maintain a rolling 30-day approved content inventory.

Responsibilities:
- Upload product assets and create product records.
- Prepare monthly member drops at least 14 days before release.
- Set machine, tier, release date, description and download asset.
- Submit each item for quality review before scheduling.
- Maintain thumbnails, product copy and preview assets.

Access:
- Content and product admin screens
- Restricted storage upload access
- No Stripe secret keys and no production database administration

### 3. Customer Support and Retention Assistant

**Primary outcome:** Resolve normal customer issues without involving the owner.

Responsibilities:
- Handle access, billing-navigation and download questions.
- Direct customers to the Stripe Customer Portal for card changes and cancellation.
- Apply approved response templates and escalation rules.
- Tag refund, dispute, abuse and technical cases for Operations.

Access:
- Customer and order lookup
- Support ticket records
- No raw payment details, service-role keys or deployment access

### 4. Quality and Compliance Reviewer

**Primary outcome:** Prevent incomplete, unsafe or off-brand products from publishing.

Responsibilities:
- Review files, descriptions, licence terms, previews and mobile download readiness.
- Approve, reject or request changes.
- Confirm each product meets the launch certification checklist.
- Record the reviewer and decision in the content review log.

Access:
- Review queue and preview assets
- Approval rights only; no billing or infrastructure access

## Owner approval rules

Brooke approval is required only for:
- New pricing or subscription-plan changes
- Refunds above AUD $150
- Charge disputes, legal complaints or privacy incidents
- New machine categories or major brand changes
- Production database deletion or destructive migrations
- Public launch of a new flagship product

Everything else should follow the SOP and be completed by the assigned coworker.

## Monthly subscription policy

Do not manually renew subscriptions. Stripe Billing is the authority for recurring charges.

Required webhook coverage:
- `checkout.session.completed`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `charge.refunded`
- `charge.dispute.created`

The application must update customer entitlements from webhook events, not from browser redirects or manual admin changes.

## Scheduled-drop process

1. Content Manager creates a `content_drops` record with status `scheduled`.
2. The asset is uploaded and checked before the release date.
3. Vercel Cron calls `/api/cron/run` daily.
4. The route authenticates with `CRON_SECRET` and marks due records as `released`.
5. Released drops appear in the customer vault.
6. Failures are logged and assigned to Operations.

## Hiring application scorecard

Score each applicant from 1 to 5:

| Criterion | Weight |
| --- | ---: |
| Reliability and documented follow-through | 25% |
| Experience with Stripe, Shopify/SaaS or digital products | 20% |
| Ability to follow SOPs without constant supervision | 20% |
| Written customer communication | 15% |
| Basic Vercel/Supabase/GitHub familiarity | 10% |
| Availability and response time | 10% |

Minimum recommended score: 4.0/5 overall, with no score below 3 for reliability or SOP adherence.

## First 14 days for a new coworker

- Days 1–2: Read-only access and SOP training.
- Days 3–5: Complete test cases in Stripe test mode and staging.
- Days 6–7: Process supervised support and content tasks.
- Week 2: Own one queue with daily audit by Operations Coordinator.
- Production permissions are granted only after the test checklist is passed.

## Security rules

- Never share `STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXTAUTH_SECRET` or `CRON_SECRET` in chat, email or shared documents.
- Use named accounts and least-privilege access.
- Remove access immediately when a coworker leaves.
- Require two-factor authentication on GitHub, Stripe, Vercel and Supabase.
- Record significant admin actions in an audit log.
