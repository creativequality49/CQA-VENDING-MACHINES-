# CQA launch repair — 7 November 2026

Launch recommendation: **NOT READY**. This repair does not approve customer
launch, enable live checkout, publish advertising or accept account agreements.

## Current source and scope

Production was independently mapped to main commit
`9ed7658c40361d624f5fb8e2810ac81dd330de81` through GitHub deployment status and
the matching Vercel deployment ID. The local checkout was fast-forwarded to that
source before these repairs. An earlier alternative delivery implementation is
preserved on a local audit branch; it is not the release design.

The existing design remains: private R2 objects, one immutable file per offer,
verified Supabase buyers, durable `cqa_orders.buyer_user_id` entitlements and
600-second signed downloads. No new delivery tables are introduced.

## Repairs

- Digital checkout records a server-authored pending order before returning the
  Stripe URL. Buyer, tenant, machine, offer, expected amount/currency and Checkout
  identity are verified again against actual Stripe facts during fulfillment.
  Changing payer email cannot transfer the entitlement. Failure to persist the
  pending contract expires the newly created Checkout.
- Digital products support one-time purchases. Anonymous identities are denied.
  The actual payment ID is bound before checking charge state so refund events
  can find and revoke the same order; terminal orders cannot become paid again.
- Downloads recheck paid entitlement after signing. Already issued signed URLs
  can remain usable for their existing 600-second lifetime. Downloaded files
  cannot be remotely recalled.
- New production paid-file uploads use the existing digital release hold until
  privacy and launch verification pass. Existing metadata reads, downloads,
  billing portal, cancellation and signed webhook processing remain available.
- The homepage again includes the existing illustrative build walkthrough and
  founding-customer waitlist. Onboarding explains the payment hold and free draft
  path. The existing service dropdown contrast is preserved.
- The integration runner fails closed on Windows before provider requests or
  signed-URL persistence because POSIX ownership, mode and no-follow protections
  are unavailable. Offline preflight remains available; its full expiry and
  permission checks still require the existing Linux verification environment.

## Explicit database follow-up

These files are **prepared, not applied**. A source deployment does not run SQL.
Apply and verify in the isolated test project first, then review production:

1. `database/cqa_marketplace_asset_immutability.sql` prevents direct owner writes
   from replacing an attached file, changing its tenant/offer relationship or
   deleting it. Archiving is permitted; replacement requires a new offer.
2. `database/cqa_admin_claims_repair.sql` removes administrator authority from
   user-editable profile metadata in the legacy catalogue policy helper. The
   unsafe source definition in `database/policies.sql` is also corrected. The
   helper RPC was absent from the isolated database (`PGRST202`), so its deployed
   production definition and effective policies remain unverified.

Actual isolated pending-order insertion and owner attempts to change trusted
payment fields were tested. Owner writes matched no rows and the stored contract
remained unchanged. Temporary unpaid schema fixtures were removed. This is a
schema/RLS check, not payment fulfillment evidence.

## Release evidence and remaining acceptance

Current handler/component regressions, lint, type checking and the production
build are separate from provider acceptance. The first type check encountered
generated route types from the preserved older branch; a fresh build removed
those stale references and the type check passed on retest.

The dated verification ledger records fresh production read-only checks,
isolated API/database checks and genuine-provider attempts separately. A valid
Checkout URL, an admin-generated confirmation token, a configuration flag or a
mocked provider response cannot establish a complete customer journey.

Still required before launch:

- Apply and test immutable-file SQL, verify effective RLS and legacy admin policy.
- Configure an isolated private R2 test bucket and narrowly scoped credentials;
  verify r2.dev/custom-domain public access is disabled and unsigned access fails.
- Finish Standard seller onboarding, including the user's required identity,
  security, phone and account agreement steps.
- Test the exact isolated deployed candidate: registration and delivered email
  clicks; plan payment and signed webhook; publication; buyer payment, correct
  fees and receipts; private download; duplicate events; declines, expiry,
  refunds and cancellation; tenant isolation; included AI work and persistence.
- Verify existing offsite Stripe catalogue Payment Links are inactive while the
  launch hold applies. The application's closed checkout routes do not prove an
  old externally shared Payment Link is disabled.
- Retest the deployed repair and obtain explicit customer-launch approval.

The first-ten programme and advertising drafts are review materials only.
No advertisements, outreach or live customer payments are authorised by this
document or by a future READY recommendation.
