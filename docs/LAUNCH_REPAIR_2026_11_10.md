# CQA launch repair — 10 November 2026

Launch remains **NOT READY**. No live-payment approval is granted by this repair.

The checkout/authentication/delivery repair from 7 November is preserved, along
with the four subsequent customer design commits through `c07a88e`.

## Changes

- Restored the homepage hero link to the existing illustrative build video.
- Closed the Automations page's direct Stripe Payment Link entry point during
  prelaunch. Its ten cards now offer founding-customer interest registration,
  with explicit paused-payment wording. Sandbox keys cannot expose these live
  links: the catalogue requires an explicit launch approval and live key mode.
- Added rendered-page regression checks for closed, sandbox and approved-live
  catalogue modes, and updated the existing homepage copy assertion.
- Excluded the private local `work/` sandbox copy from TypeScript, lint and
  production file tracing. Application source and repository tests stay checked;
  local fixtures and credentials are not production build inputs.

The separate FanX creator product is outside this CQA release hold. Previously
shared external Stripe Payment Links still require authenticated provider-side
inspection; hiding website links does not deactivate those external URLs.

## Current acceptance evidence

The dated verification matrix distinguishes local code checks, production
browser checks, actual provider evidence and historical sandbox transactions.
Fresh production evidence includes delivered owner recovery email, its correct
canonical redirect, the new-password form, an email-authenticated owner
dashboard, the signed-in plan checkout hold and complete 60-second demo playback.
No new password was entered or submitted by the agent.

## Remaining release blockers

- The isolated Supabase project is reachable and Auth works, but hosted SQL
  Editor rejects even `SELECT 1` with PostgreSQL PAM error `28000`. Prepared
  immutability and legacy administrator-policy SQL remains unapplied/unverified.
- Stripe Standard sandbox seller onboarding still requires support phone and
  the owner's agreement submission; charges and payouts remain disabled.
- Isolated private R2 storage and the full digital purchase, entitlement,
  download, refund, expiry and cross-customer journey remain unverified.
- Full delivered-email registration and password login/recovery completion,
  first publication and included AI execution/persistence remain required.

No real charges, advertisements, account agreements or paid services were
initiated. Keep launch flags closed until verification and explicit owner approval.
