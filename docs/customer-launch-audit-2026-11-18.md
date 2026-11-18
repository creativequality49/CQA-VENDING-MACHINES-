# Customer launch audit — 18 November 2026

Scope: the existing CQA Vending Machines / Machine Market repository and the
one-time customer purchase and fulfilment journey. This is not approval to
charge customers or proof that external services work end to end.

## Faults repaired

- Consumer subscriptions lacked renewal fulfilment; physical products lacked
  shipping fulfilment. New purchases of those types now fail before Stripe
  session creation and display an enquiry option.
- Paid services could omit the delivery commitment. Checkout now requires
  delivery scope, timing, support and refund/cancellation terms. Unsupported
  offer types fail closed. Digital purchases retain private-asset verification.
- Published/demo machines advertised `ONLINE` and `STRIPE READY` regardless of
  payment readiness. Labels now distinguish demonstrations, published pages
  and paused checkout; provider readiness is rechecked at checkout.
- Safety reports displayed submission success after email provider rejection.
  Rejections/exceptions now return 502; configured sender is required rather
  than Resend's restricted onboarding sender.
- Removed unused Prisma dependencies/nonfunctional scripts; updated OIDC/Zod
  with compatible source changes and patched supported transitive dependencies.

## Verification

- Full repository harness: 46 checks passed, including regression scripts,
  actual local PostgreSQL-compatible migration/RLS/transition tests,
  TypeScript, lint and the Next.js production build.
- Local browser checks passed for desktop/mobile account views, brief submission,
  owner start/delivery, customer handover refresh and logout; no page errors.
  These use intercepted fixtures with external requests blocked, not real providers.
- Builds use explicitly noncredential public configuration for prerendering;
  they do not establish remote authentication or provider availability.
- New checkout regressions cover unsupported/recurring/shipping offers and
  missing, malformed and oversized service commitments without creating a
  Stripe session. Existing purchase, signature, replay, refund, identity,
  cross-customer and private-delivery regressions remain enabled.
- Dependency audit decreased from 30 to 19 advisories (17 to 9 high; zero
  critical). Remaining Picomatch has no patched published release at this audit;
  other remaining chains include development tooling and Resend rendering
  dependencies. This does not constitute a clean dependency audit.

## Release blockers

1. The prepared customer-fulfilment migration has not been applied remotely.
   Automatic approval review rejected the attempt on CQA Launch Test
   (`ndzmlywsuywkhgqdbzft`) because explicit approval to change that project's
   existing data was absent. Obtain that specific approval before retrying.
2. Confirm the Stripe test account before account-specific operations. Then
   verify a genuine confirmed buyer, hosted checkout, signed webhook, durable
   order, receipt, owner fulfilment, customer access and refund revocation in
   an isolated preview with isolated database/storage/provider credentials.
3. Publish a real, priced deliverable offer. The production catalogue audit
   found zero live priced saleable offers; the proposed A$29 Business Launch
   Kit has no delivery assets. Do not treat catalogue copy as fulfilment.
4. Validate the final production configuration, connected merchant readiness,
   legal offer terms and provider behaviour before enabling live checkout.

Production health returned HTTP 200 with configuration indicators, but those
indicators do not prove delivery or a working charge. Existing Render PR preview
failure remains separate from the successful Vercel previews and needs its
provider deployment logs before resolution.
