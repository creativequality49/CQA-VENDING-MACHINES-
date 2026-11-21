# Merchant product delivery

This extends the existing CQA merchant storefront and customer portal. It does not replace the app or present a carrier connection request as a working integration.

## Supported journeys

- **Digital product:** owner saves a draft, uploads its private file, publishes its terms and activates the product. Checkout verifies the actual private object before selling. Verified paid webhooks create the order and download entitlement. Buyer access is account-bound; refunds revoke further access. A downloaded file cannot be recalled.
- **Physical product:** owner configures tracked stock, supported countries, a flat delivery fee, dispatch timing, support and refund terms. Checkout reserves one unit and collects an address through Stripe. A verified paid event commits stock and creates one private shipment. Merchant packs/ships using their own carrier, then records tracking in Orders & dispatch. The buyer sees that tracking in their account. This does not purchase labels, call a warehouse or arrange carrier collection.
- **Service:** buyer pays for a defined scope, submits a brief and receives the owner's handover through the order workspace. Payment does not reserve an appointment.

One product / one unit per checkout is supported. Separate products can represent separate SKUs; variant selection and multi-item shipping are not implemented. Consumer recurring offers remain held. AI workers prepare drafts; they do not independently buy stock or dispatch parcels.

## Merchant controls

`/owner/products` creates and edits digital/physical offers and displays on-hand, reserved and available stock. Stock is adjusted by signed quantities with a revision; clients do not overwrite inventory totals. Private download keys never enter this management API's response. Product imagery remains public; paid product files belong in private upload storage.

`/api/owner/readiness` reports offer-specific configuration issues, private object checks, plan and merchant payment onboarding checks, plus platform checkout holds. It does not claim a successful transaction or delivered email. Publishing enforces the shared offer checks.

`/marketplace` lists published merchant machines and their active offers. Example machines are explicitly separate demonstrations. `/machine/[slug]` displays the merchant catalogue and server-gated checkout controls.

## Order lifecycle

Reservations, payment settlement, fulfilment jobs and shipments are durable database records. Signed Connect events establish payment. The browser return page cannot fulfil an order. Replays must not create another shipment or debit stock twice. Failed/expired sessions release uncommitted holds; ambiguous payment outcomes require reconciliation rather than unsafe stock reuse. Refunds revoke entitlements and cancel unshipped work; committed/shipped inventory is not automatically restocked. Returned goods require an explicit stock adjustment after inspection.

Shipment updates require the owning merchant, a paid order and the current revision. Shipping addresses are stored in private order shipment records, never the public product configuration. Tracking reflects merchant input; carrier events are not automatically synchronized.

## Release requirements

Deploy the reviewed `merchant_product_fulfillment` migration to the isolated test database first. Run repository regressions, PostgreSQL transition/isolation tests and browser checks. Configure isolated Stripe Connect webhooks, receipts and public authentication callbacks, then prove a real test payment through its buyer delivery path and refund before production release.

`CQA_PHYSICAL_DELIVERY_APPROVED=true` is an additional server-only hold, on top of the existing checkout isolation/production approval checks. Do not enable it until shipping and inventory acceptance tests pass. Existing digital delivery approvals remain separate.

A live merchant/carrier connection and genuine buyer acceptance tests are external integration evidence; local provider fixtures do not establish them. Current remote configuration blockers are documented in `first-customer-launch-status.md`.

## Selected Stripe test account

The owner authorized the existing account with matching prices. Read-only catalogue comparison selected **CQA Isolated Launch Test** (`acct_1UPzM6P6kjGSpjgk`): Starter A$97/month, Pro A$297/month and Enterprise A$997/month. Existing `.env.preview.example` price IDs match this account. The older Creative Quality Australia sandbox has different historical prices and was not changed. This selection does not establish that the deployed API key, webhook or merchant onboarding is configured correctly; never switch test keys to live automatically.

## Isolated database evidence

Migration `20261121040553_merchant_product_fulfillment.sql` is applied to CQA Launch Test only. Its filename matches the Supabase migration history. `tests/fixtures/merchant-fulfillment-remote-rollback.sql` passed against the actual existing schema: nonzero shipping totals, stock reservation floor, exactly-one debit/job, late payment denial after release, shipment revisions, refund history and owner/outsider isolation. All fixture data was rolled back. This is not proof of a genuine provider checkout or physical dispatch.

## Merchant operations overview and appearance

`/owner/operations` brings machine status, current paid-order totals by currency, an all-time fulfilment attention list and active physical-product stock alerts together. Its restock CSV suggests only the units needed to reach six available units; it never places a supplier order. Figures refresh on request and show their timestamp. Sales cover 30 UTC calendar days by order creation date, include shipping, exclude fully refunded/cancelled orders and do not deduct fees or partial refunds. They are not profit or payout balances. Owner-scoped paginated reads reject incomplete totals rather than treating failures as zero.

The global navigation has a Light/Dark control. Light is the default and uses white page backgrounds. A browser-local `cqa-theme` preference is applied before paint, persists across pages/reloads and synchronizes across tabs. `app/color-theme.css` owns the shared theme tokens and legacy surface overrides. Self-contained illustrative artwork uses `data-theme-art` so its image/diagram contrast is preserved independently of the surrounding page theme. Browser checks cover 19 public pages plus the authenticated operations screen using explicitly labelled local fixtures.
