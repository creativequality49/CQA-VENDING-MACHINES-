# CQA Automation Completion Backlog

This backlog separates what is now automated from the remaining production work required for a genuinely hands-free platform.

## P0 — Revenue and access integrity

- Replace remaining `lib/mock-store` use with Supabase repositories for customers, orders, subscriptions and entitlements.
- Extend Stripe webhook handling for `invoice.paid`, `invoice.payment_failed`, `customer.subscription.created`, `charge.refunded` and `charge.dispute.created`.
- Add a reconciliation job that compares active Stripe subscriptions with Supabase entitlements and repairs mismatches idempotently.
- Add Stripe Customer Portal entry from the account and billing pages so customers manage card changes and cancellations themselves.
- Add durable webhook failure logging and an operations retry queue.

## P1 — Automated fulfilment

- Send purchase, subscription, cancellation and content-drop email notifications through Resend.
- Validate that every published product has a storage object, preview, licence, price and secure download mapping.
- Add download-failure logging and a one-click entitlement repair action for Operations.
- Add release notifications for each successfully released content drop.

## P1 — Coworker control plane

- Add database-backed staff roles: owner, operations, content_manager, support and reviewer.
- Add protected admin routes and permission checks for each role.
- Add task queues for failed payments, missing entitlements, failed downloads, pending reviews and scheduled releases.
- Add audit logging for refunds, entitlement changes, publishing, role changes and destructive actions.

## P1 — Monitoring

- Add `/api/health` checks for Supabase, Stripe configuration, storage and cron freshness.
- Alert Operations when no successful cron run has occurred within 26 hours.
- Alert on webhook signature failures, repeated processing failures and unresolved payment disputes.
- Add deployment checks for lint, typecheck and production build on every pull request.

## P2 — Product operations

- Add a rolling 30-day content calendar and minimum inventory warning.
- Add clone-machine and clone-product workflows for faster catalogue expansion.
- Add scheduled price and promotion windows without manual code changes.
- Add monthly reporting for recurring revenue, churn, failed payments, refunds, downloads and machine-level conversion.

## Production completion definition

The website is considered hands-free only when this complete journey passes:

`Sign-up → product selection → Stripe payment → verified webhook → durable entitlement → customer vault → secure mobile download → confirmation email → duplicate-event protection → renewal → failed-payment recovery → cancellation → refund handling → dispute escalation → admin visibility`

No product or subscription should be marked live until the journey has passed in Stripe test mode and production smoke testing.
