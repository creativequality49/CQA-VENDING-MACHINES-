# CQA business terms — approval draft

Prepared 31 October 2026. UNPUBLISHED: these are proposed commercial choices,
not existing approved policies or a claim that CQA is ready for paying customers.
Brooke must confirm the legal operator, GST treatment and outstanding operational
details before these become public /terms, /refund-policy and /privacy pages.

## Proposed service terms

Creative Quality Australia is operated by **[verified legal person/entity]**,
**[ABN, if applicable]**. Customers can use the existing /contact page. These
terms concern CQA's own automation implementation and ongoing service; each
storefront seller must separately identify its supplier and offer terms.

Before payment, CQA and the customer agree in writing on the workflow,
deliverables, integrations, required access, customer inputs, acceptance checks
and implementation timing. Starter covers one agreed workflow; Pro covers up
to three connected automations; specialist workers have their listed purposes.
Additional work requires an agreed quote before work or charges.

Delivery dates are agreed per project. No universal turnaround is promised.
Customers supply accurate requirements, permitted access and requested approvals.
CQA communicates material delays and agrees revised arrangements. Applicable
consumer guarantees, including reasonable delivery timing, are preserved.

The existing checkout summary states setup, monthly and first-payment amounts
in AUD. First payment is setup plus month one. Monthly billing continues until
cancellation takes effect. **Insert verified GST wording before publication.**
Identify third-party subscriptions and usage costs, and who pays, in the quote;
obtain approval before incurring additional costs.

Maintenance/support follow the agreed scope. Specify monitoring frequency,
response times, availability and major upgrades in writing when offered. No
revenue, savings or error-free AI/automation performance is guaranteed.

## Proposed cancellation and refund policy

**Recommended choice for Brooke to approve:** customers may request cancellation
through /contact before their next renewal. Recurring service ends at the close
of the paid billing period; CQA confirms the effective date. No extra cancellation
penalty is proposed. This is not a description of verified live Stripe settings;
those settings and the cancellation procedure must match the approved policy.

For change of mind, refund unused setup work. Once implementation has started,
explain completed work and any expressly approved unrecoverable third-party
costs; refund the appropriate unused balance. This proposed voluntary policy
needs Brooke's agreement and an operational process before publication.

Australian Consumer Law rights and mandatory remedies remain available. Service
problems are assessed according to their nature and the applicable remedy; these
commercial terms must not exclude those rights or impose a blanket no-refund rule.

## Proposed ownership and offboarding

Customers retain their supplied data, branding and materials and must have
permission to supply them and authorise processing.

**Recommended choice for Brooke to approve:** after payment, customers receive
the agreed bespoke deliverables/configuration exports. CQA retains its existing
tools, templates and general know-how; the brief specifies the customer's rights
to use any included CQA components. Third-party licences continue to apply.
Specify any assignment or ongoing licence explicitly in the agreed brief.

CQA-hosted operation and ongoing service end on the confirmed cancellation date.
Customer-owned third-party accounts remain theirs. Before purchase, document
export availability, transfer responsibilities, separately quoted assistance and
retention/deletion arrangements. Do not promise that every automation continues
independently after cancellation.

## Privacy draft and verified source facts

CQA collects supplied contact, account, business and project information, order
and payment references, and relevant technical usage information to handle
enquiries, provide services, administer accounts/payments and troubleshoot.
The reviewed CQA contact form does not ask for full card details.

| Handling path found in source | Evidence | Must still verify |
|---|---|---|
| Contact details and implementation briefs go to Supabase | app/api/contact/route.ts | Retention, authorised staff and deletion process |
| Optional contact-to-CRM forwarding | app/api/contact/route.ts | Whether configured and its destination |
| Stripe checkout and order/payment references | Marketplace checkout/webhook routes | Live account, approved handoff and billing settings |
| Server-side Cloudflare R2 file uploads and expiring links | lib/storage.ts | Real bucket privacy, region and retention |
| Vercel Analytics is included globally | app/layout.tsx | Actual collection and sign-in/cookie disclosures |
| Resend transactional email when configured | lib/cqa-transactional-email.ts | Sender, recipients and retention |
| Optional direct AI provider or Vercel AI Gateway receives task context | lib/cqa-ai-provider.ts; lib/cqa-ai-core.ts | Provider, regions, data handling and customer approval |

These are source paths, not proof of active configurations or a compliance audit.
Do not claim Australian-only processing, no analytics, no AI data sharing,
absolute security or immediate deletion. Disclose actual overseas recipients
and countries where practicable after verification.

Customers can use /contact to request access/correction or raise a privacy
complaint. **Confirm the responsible contact and complaint process.** Set and
verify a retention/deletion schedule covering financial records, backups and
provider limitations. Integration credentials require a separate secure process;
customers should not send passwords, API keys or card details through enquiries.

Determine Privacy Act applicability rather than assuming a small-business
exemption. Review any automated decisions significantly affecting individuals.

## Inputs and approvals needed to finalise

1. Legal operator/ABN; verified GST registration and whether current advertised
   prices include GST. No price or GST statement has been changed.
2. Approve or edit the proposed cancellation/refund and ownership defaults above.
   Scope and delivery dates can be agreed in writing per customer, with no new
   fixed timeline or integration/support promises invented.
3. Verify live providers/regions, CRM/AI/analytics configuration, human access,
   retention/deletion and complaints handling before finalising privacy wording.
4. Match live Stripe billing/cancellation and post-payment handoff to the approved
   terms, then publish/link the reviewed policies as part of an approved release.

## Primary guidance consulted

- ACCC consumer guarantees: https://www.accc.gov.au/business/selling-products-and-services/consumer-rights-and-guarantees
- ACCC remedies: https://www.accc.gov.au/consumers/problem-with-a-product-or-service-you-bought/repair-replace-refund-cancel
- ACCC contracts: https://www.accc.gov.au/consumers/buying-products-and-services/contracts
- OAIC privacy policy guidance: https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-1-app-1-open-and-transparent-management-of-personal-information
- OAIC small-business coverage: https://www.oaic.gov.au/privacy/privacy-guidance-for-organisations-and-government-agencies/organisations/small-business

This draft is for business/legal review. It does not establish CQA's legal status
or certify that proposed terms match the still-unverified production operations.
