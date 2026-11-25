# Order delivery and ongoing support

Customers can ask the selling business for help from `/account/orders/[orderId]`.
The order reference and business are attached automatically. Merchants reply
from `/owner/orders`, including an inbox of conversations awaiting their reply.
Both parties can resolve or reopen a conversation; a new message reopens it.
Message history is paginated. Support remains available after refunds, without
restoring payment, entitlements or downloads.

For a paid, delivered service, the customer can explicitly acknowledge receipt.
This is a customer statement, separate from merchant delivery and payment state.
It does not prove a digital file was transferred, a machine is operational or
that a customer has waived support/refund rights. Digital downloads and physical
shipments retain their existing fulfilment paths.

## Security and reliability

- Supabase verifies the customer or merchant session before private reads.
- The server derives order ownership, business and actor; POST bodies cannot
  select those identities. The merchant inbox double-checks RLS order ownership.
- Database changes lock the order and thread, compare revisions and atomically
  save the message, request ID and support status.
- Retrying a request ID with the same actor/order/action/message is idempotent,
  including after the client refreshes to a newer revision. Reusing it for a
  different operation is rejected.
- Per order and actor, messages are capped at 5/minute and 100/day; all support
  updates are capped at 20/minute and 200/day. Successful retries bypass caps.
- RLS is enabled; browser roles have no direct support-table or RPC access.
  Server responses omit actor IDs and use private, no-store caching.
- Drafts survive failed submissions and history navigation. Session/order
  changes clear private UI and abort pending requests.

## Release

This change depends on the checkout/delivery candidate in PR #52. It requires
`supabase/migrations/20261126010000_order_support.sql`; the migration is prepared
in source and has not been applied to a remote database by this change.

Apply it to the isolated CQA Launch Test database before testing the candidate.
Verify with two customers and two merchants: own-order conversation, foreign
order denial, seller inbox/reply, resolve/reopen, explicit service receipt,
duplicate retry and support after refund with download still revoked. Do not
publish raw customer conversations, access tokens or signed links as evidence.

Local verification includes the real migration in PGlite, API ownership/failure
tests and intercepted browser fixtures. These do not establish provider payment
or email delivery. The candidate still needs a genuine Stripe sandbox checkout
through verified webhook, entitlement, private download, second-account denial
and refund revocation before a production release decision.

Run `npm run test:order-support` for SQL and API checks. For the intercepted
browser test against the harness's compilation-fixture build, start that build
locally and run
`CQA_UI_SUPABASE_HOST=cqa-build-only.supabase.co npm run test:customer-ui`.
The normal browser fixture in `docs/customer-fulfillment.md` remains the default.
The release workflow runs these browser fixtures at desktop and mobile sizes.
The local browser attempt was blocked because the installed launcher had no
browser binary and the browser download returned 403; it was not counted as
passed.

At inspection on 26 November 2026 (Adelaide), public health returned 200, while
the PR #52 Preview returned 503 with invalid Stripe configuration and incomplete
private-storage/email/Connect webhook configuration. The test database contained
no automation run records. These are configuration and verification blockers,
not evidence that the entire customer journey has passed.

## Support operations

The inbox is manually monitored. No customer email notification or background
AI response is introduced, and no response-time promise is made. Existing AI
workers prepare owner-reviewed drafts; health/configuration alone does not
prove those jobs ran. Open requests are ordered oldest-first in the seller
inbox so older purchases remain discoverable. Global CQA account or machine
subscription enquiries still use the existing contact channel.

Rollback: revert the application commit first. The new support tables can stay
private to retain history; do not drop customer conversations during rollback.
