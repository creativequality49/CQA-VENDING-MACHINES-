# Automations page: implementation and launch review

Prepared 31 October 2026. These source changes are reviewable; this document
is not a claim that a customer payment, integration or live automation was tested.

## What existed and what changed

The page already had the required headline, three core packages, seven specialist
workers, ten Stripe Payment Links, first-payment calculations, a custom quote
range and a contact route. It lacked a core comparison and FAQ, used an unsupported
ready-to-deploy/live-checkout message, and directed customers toward a public
success page that implied verified payment without checking a payment reference.

The required headline and both hero CTAs remain. The redesigned page uses black,
white and neon pink, scoped CSS, readable charge summaries next to each checkout
link, a responsive three-package comparison, eight native disclosure FAQs and
contact CTAs for undecided buyers and unknown terms. Starter explicitly covers
one agreed workflow; specialist workers have their existing defined purposes.
Existing offer data, prices, custom quote range and all ten Stripe URLs are unchanged.
Navigation labels are clearer and every existing destination remains available.

The implementation handoff uses the existing contact form with
`service=automation-implementation`. That parameter is already accepted by the
contact API and persisted via cqa_submit_sales_lead. The form now has accessible
field names, duplicate-submit protection and recoverable network/error states;
a malformed or unconfirmed response cannot display success. The public handoff
page no longer claims that opening its URL proves payment.

## Price and existing-link verification

All ten original links returned HTTP 200. Each hosted Stripe page was also read
in the browser without entering payment information or clicking Subscribe. Their
AUD setup, recurring charge and initial total matched the existing catalogue:

| Offer | One-time setup | Monthly | First payment |
|---|---:|---:|---:|
| Automation Starter | $497 | $99 | $596 |
| Automation Pro | $897 | $249 | $1,146 |
| AI Business Operations | $1,997 | $449 | $2,446 |
| AI Lead Finder | $497 | $99 | $596 |
| AI Content & Marketing Worker | $497 | $129 | $626 |
| AI Customer Follow-Up Worker | $397 | $99 | $496 |
| AI Receptionist | $797 | $249 | $1,046 |
| Competitor & Market Monitor | $497 | $129 | $626 |
| Product & Order Automation Worker | $697 | $149 | $846 |
| Real Estate Property Intelligence Worker | $997 | $249 | $1,246 |

All amounts above are AUD. This confirms the displayed default checkout summary,
not completion of a charge or GST registration/inclusion. The connected Stripe
API account is a sandbox, so live billing settings and post-payment redirects
were not inspected or changed through that account.

## Checks

- Six behavioural groups in tests/automations-page-check.mjs render the genuine
  page/navigation/handoff and execute the real contact-form handler with mocked
  network responses: all original links, totals, anchors and routes; eight FAQ
  disclosures; launch/GST wording; false payment confirmation prevention; form
  network/503/malformed/false-success errors; duplicate submission and successful
  implementation-brief payload.
- All 19 available check groups passed, including the configured regressions,
  TypeScript, lint and production build. Existing lint warnings remain; no errors.
- Responsive source uses minmax(0,1fr), single-column layouts at narrow widths,
  readable wrapping and 48px CTAs. Native summary controls support keyboards;
  visible focus styles and labelled contact fields are present.
- Browser visual/viewport QA could not reach the local server (connection refused).
  Therefore screenshot appearance, computed small-screen overflow and end-to-end
  contact database persistence remain unverified. No real enquiry was submitted.

## Decisions and remaining launch requirements

1. GST: confirm registration and whether the existing prices include GST. No GST
   claim was invented. The page directs customers to confirm it before checkout.
2. Terms: /terms, /privacy and /refund-policy returned HTTP 404, and no matching
   policy pages were found in this repository. Approve actual service, privacy,
   cancellation/refund, offboarding and ownership/licensing terms before linking
   or publishing them. No invented policies or broken policy links were added.
3. Scope: confirm supported integrations, delivery dates, monitoring/support
   commitments and third-party software charges for each engagement. Existing
   catalogue features are retained, with no new promises.
4. Handoff: confirm each live Stripe Payment Link redirects to /automations/success
   or otherwise sends buyers to the implementation brief. The contact-based path
   is implemented, but the live redirect/notification settings are not verified.
5. Payments/fulfilment: genuine purchase, webhook, refund, private storage and
   account-isolation integration evidence is still required for the marketplace.
   Checkout holds and the real launch-status disclosure remain unchanged.

No payment, product, price, Stripe setting, schema or production release was made
by this change. No booking link, testimonial, rating, urgency or performance
claim was invented.
