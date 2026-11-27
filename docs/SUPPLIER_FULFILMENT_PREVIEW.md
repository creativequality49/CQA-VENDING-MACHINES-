# Supplier fulfilment Preview pilot

Legacy products still use their existing checkout and delivery paths. The new supplier-fulfilment and referral listing types are available in an isolated Preview. Use Seller shipped for inventory you already hold, including stock sourced through Alibaba.

## Preview setup

Apply the three supplier migrations in filename order to CQA Launch Test (`ndzmlywsuywkhgqdbzft`). Use branch-scoped Preview variables from `.env.preview.example`, the matching test Supabase keys, CQA Isolated Launch Test Stripe account, a sandbox connected merchant, and the sandbox Connect webhook signing secret. Keep all production settings as they are. Confirm the deployed commit and inspect `/api/health` for matching database URLs and actual Stripe account before enabling the Preview flags.

Set `CQA_PHYSICAL_DELIVERY_APPROVED=true` and `CQA_SUPPLIER_PILOT_ENABLED=true` only on that Preview branch after checking isolation. Start with the **Mock supplier**. Hosted Stripe Checkout collects the address, and an isolated Stripe webhook records payment. Customer shipping is the seller-configured flat rate in AUD. The supplier's own freight and landed cost are quoted and approved independently in the provider's currency.

## Acceptance

1. Create one physical mock supplier listing with an AU shipping fee. Purchase it with a confirmed test buyer and a Stripe sandbox card. Verify a single paid order, private shipment, and pending supplier approval.
2. Replay the signed payment event. Check that the shipment and supplier fulfilment row are unchanged. Sign in as a different seller and verify the approval and address routes deny access.
3. Refresh the supplier quote. Change the mock stock or cost override in the isolated test environment, then approve the old quote. Verify the new quote is shown and another approval is required.
4. Refund a separate paid test order before approval and verify that it is blocked. Refund an already submitted order and verify that it is flagged for cancellation or return review.
5. Approve the unchanged mock quote, refresh tracking as the seller, and check the buyer order page. Confirm that the supplier payment state is separate from the Stripe buyer payment.
6. Publish an affiliate test listing with a valid HTTPS link. Confirm that the storefront opens the referral and the checkout API creates neither a Stripe session nor a CQA order for it.

The supplier order reference is the CQA order UUID. If submission times out, use **Reconcile with supplier**. A missing match keeps the order on hold for manual investigation. The system will never automatically resubmit an ambiguous order.

## CJdropshipping

The CJ adapter uses the API v2 variant, freight, order, and tracking endpoints. With a configured server-only `CQA_CJ_API_KEY`, order creation uses CJ sandbox mode and creates an unpaid order. The pilot never calls a supplier payment endpoint. Provider access, actual sandbox responses, stock, quotes and shipping routes require separate CJ verification.

[CJ API overview](https://developers.cjdropshipping.com/en/api/api2/) · [CJ development guide](https://developers.cjdropshipping.com/en/api/start/development.html) · [CJ order API](https://developers.cjdropshipping.com/en/api/api2/api/shopping.html)
