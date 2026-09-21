# CQA Launch Catalogue and Fulfilment Gates

This document is the production source of truth for the first five CQA digital products.

A product must not be sold until all launch gates pass:

1. Final customer-facing files are complete and quality reviewed.
2. The final delivery bundle is uploaded to private R2 storage.
3. `assetKey` in `lib/catalog.ts` points to that exact bundle.
4. A dedicated Stripe Product and AUD Price exist.
5. The matching `STRIPE_PRICE_*` environment variable is configured in Vercel.
6. Catalogue status is changed to `live` only after review.
7. Test-mode Stripe checkout succeeds.
8. Webhook creates exactly one entitlement.
9. Product appears in the customer library.
10. Signed download succeeds on a real mobile device.
11. Confirmation email arrives and contains the correct order details.
12. Refund, dispute, failed-payment and cancellation policies are tested.
13. Customer Portal and admin fulfilment visibility are verified.

## Product status

| Product | Canva source | Current status | Final product work required |
|---|---|---|---|
| CQA Money & Wealth Operating System | `DAG68VVO8SA` | Draft | Complete every promised workbook, planner, calculator, guide and 30-day challenge; validate claims; export and package final files. |
| CQA Faceless Income Machine | `DAHAEOPrEHY` | Draft | Rebuild the incomplete prompt-card source into a full faceless-brand operating system with content, offer, traffic and automation resources. |
| CQA Creator Prompt Vault | `DAG8xYJstfs` | Draft | Validate that there are exactly 200 useful, non-duplicated prompts; organise them by outcome; add usage and licensing guidance; export final files. |
| CQA 30-Day Muscle Growth System | `DAHHeY_KS1U` | Quality review | Validate the 24-page program, add clear exercise and health disclaimers, proofread, improve mobile readability and create the final delivery bundle. |
| CQA Anxiety & Mental Wellness Toolkit | `DAG7BsfmhoM` | Draft | Reposition as non-clinical wellbeing education; add safety, professional-help and crisis guidance; complete the workbook, cards and planner; quality review all claims. |

## Dedicated Stripe environment variables

- `STRIPE_PRICE_MONEY_WEALTH`
- `STRIPE_PRICE_FACELESS_INCOME`
- `STRIPE_PRICE_CREATOR_PROMPT_VAULT`
- `STRIPE_PRICE_MUSCLE_GROWTH`
- `STRIPE_PRICE_ANXIETY_WELLNESS`

Do not reuse generic Basic, Pro or Elite Stripe prices for these products. Each product requires its own Stripe Product and Price so orders, refunds, analytics and fulfilment remain auditable.

## Current pricing for review

- Money & Wealth Operating System: **$149 AUD**
- Faceless Income Machine: **$129 AUD**
- Creator Prompt Vault: **$79 AUD**
- 30-Day Muscle Growth System: **$97 AUD**
- Anxiety & Mental Wellness Toolkit: **$67 AUD**

Prices are catalogue proposals and should remain non-chargeable until the corresponding deliverable passes the launch gates.
