# Creative Quality Australia AI Vending Machine

Unified Next.js 15 App Router project for:
- Customer vault and secure downloads
- Stripe checkout + webhook entitlement flow
- Subscription drops + cron release endpoint
- Scarlett May funnel and FanXFantasy routes in the same app
- Vercel multi-domain routing behavior

## Run locally

Use Node.js 22.13 or newer; the local checks have been run with Node.js 24.
From this repository:

```bash
npm ci
cp .env.local.example .env.local
# Fill in the isolated Supabase URL and browser key in .env.local.
npm run local:check
npm run dev
```

Open `http://localhost:3000`. Next.js loads `.env.local` automatically during
`next dev`. It does not load a file named `.env.preview.local` during ordinary
local development. Keep credentials in ignored local environment files.

The local template uses localhost origins and empty provider settings. Public
browsing does not establish working authentication, payments, generation or
fulfilment. Account screens and service-backed features need the corresponding
real service configuration; missing settings should be resolved before testing
those flows. `local:check` reports configuration readiness, not external-service
or payment verification.

Configure only the services needed for the flow being tested:

- Supabase: an isolated project's URL, public browser key, and server-only
  service credentials for server operations. Never put a service-role or secret
  key in a `NEXT_PUBLIC_` variable.
- Stripe: isolated test credentials, matching Price IDs and webhook secrets.
  The customer launch and digital-delivery holds remain in force. Ordinary
  localhost development does not satisfy the existing Vercel Preview isolation
  gate; use the documented isolated Preview environment for commerce verification.
- Protected downloads: private object storage and its server credentials.
- Generation and automation: the relevant AI/media provider credentials;
  email steps also need a verified sender and email provider.
- Age-restricted FanX routes: validated external age assurance and its signing
  secret. Missing verification must never unlock restricted content.

The existing production-oriented `.env.example` is a reference, not the starting
point for local development. Do not copy production database configuration into
an isolated local test setup. `.env.preview.example` documents the separate
isolated hosted Preview environment. See
[commerce launch verification](docs/commerce-launch-verification.md) for its
requirements and remaining integration evidence.

## Database setup

Schema material lives in `database/*.sql`. This repository currently has no
`prisma/schema.prisma` or `prisma/seed.ts`, so the advertised `db:migrate`,
`db:push` and `db:seed` package scripts are not a usable database setup path.
Review the applicable SQL and migration order against an isolated database
before applying it; do not run the SQL collection blindly against production.

See the [app and repository map](docs/app-repository-map.md) for which existing
GitHub, Sites, Vercel and Supabase projects belong to this work.

## Verification and production build

```bash
node scripts/cqa-engineer/checks.mjs
```

This runs repository regressions, TypeScript, lint and a compilation check. Its
build child uses non-credential public Supabase placeholders only when public
configuration is absent, allowing compilation of auth UI in CI. Existing
configuration is not replaced. These placeholders are not application defaults
or usable provider credentials; do not deploy that local build or treat it as
integration evidence.

For a deployable production build, configure the real target environment first,
then build afresh:

```bash
npm run build
npm run start
```

A successful build does not verify checkout, webhook delivery, entitlements or
paid downloads. Scheduled Vercel jobs also do not run automatically under
`next dev`; a local scheduler must call the configured cron endpoint with the
required authentication when testing automation.

## Key Routes

- `/` main CQA homepage
- `/machine/store` core vending machine
- `/machine/scarlett-vault` Scarlett machine
- `/fanxfantasy` FanXFantasy public landing page
- `/vault` customer vault
- `/scarlett` funnel page
- `/admin` admin dashboard
- `/api/stripe/checkout`
- `/api/stripe/webhook`
- `/api/signed-download`
- `/api/cron/automations` scheduled automation endpoint

## Customer purchase and fulfilment workspace

`/account` gives verified customers their purchase history, service briefs,
progress, protected deliveries and subscription-management entry points.
`/owner/orders` gives business owners a scoped fulfilment queue with private file
uploads and revision-checked handovers. Digital products use the existing private
library. See [customer fulfilment](docs/customer-fulfillment.md) for the required
database migration, rollout boundary and integration-verification steps.
