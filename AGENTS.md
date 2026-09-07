# AGENTS.md

## Project
Creative Quality Australia production platform.

## Mission
Build, repair, and ship a monetised SaaS/product platform with:
- Next.js
- Supabase
- Stripe
- Protected vault delivery
- Conversion-focused UX

## Core rule
Always work inside the existing repository.
Do not scaffold a replacement app unless explicitly asked.

## Operating model
Use a multi-agent workflow:
1. Builder agent implements or repairs the production path
2. Tester agent validates code, flows, and failure cases
3. Optimiser agent improves conversion, UX, and maintainability
4. Release audit agent performs final ship-readiness review

## Source of truth priorities
1. Working monetisation path
2. Secure auth and entitlement path
3. Protected paid-content delivery
4. Clean build and deployment readiness
5. Premium UX polish

## Required end-to-end flow
Visitor -> pricing -> checkout -> webhook -> entitlement -> vault unlock

## Stripe rules
- Checkout session creation must be server-side
- Webhook is the source of truth for granting or revoking access
- Support at minimum:
  - checkout.session.completed
  - customer.subscription.created
  - customer.subscription.updated
  - customer.subscription.deleted
- Deduplicate webhook processing

## Supabase rules
- Use auth safely on server and client boundaries
- Never expose service role keys to client code
- Prefer protected storage with signed URLs or server-mediated delivery
- Use durable entitlement records

## Vault rules
- No public paid asset URLs
- Only entitled users can access vault items
- Unlock must become visible immediately after fulfillment

## Quality bar
Done means:
- build passes
- lint/typecheck pass if configured
- payment path works
- entitlement path works
- vault gating works
- env variables are documented
- deployment blockers are isolated or fixed

## Style
- production-minded
- minimal diffs where possible
- no placeholder business logic
- fix root causes, not symptoms
