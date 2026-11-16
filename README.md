# Creative Quality Australia AI Vending Machine

Unified Next.js 15 App Router project for:
- Customer vault and secure downloads
- Stripe checkout + webhook entitlement flow
- Subscription drops + cron release endpoint
- Scarlett May funnel in the same app
- Vercel multi-domain routing behavior

## Run

```bash
npm install
npm run dev
npm run build
npm run start
```

Run repository checks with `node scripts/cqa-engineer/checks.mjs`. Its build child
uses non-credential public Supabase placeholders only when public configuration
is absent, allowing compilation of auth UI in CI. Existing configuration is not
replaced. These placeholders are not application defaults or usable provider
credentials; do not deploy that local build or treat it as integration evidence.
Use the real environment configuration and a fresh build for deployment.

## Key Routes

- `/` main CQA homepage
- `/machine/store` core vending machine
- `/machine/scarlett-vault` Scarlett machine
- `/vault` customer vault
- `/scarlett` funnel page
- `/admin` admin dashboard
- `/api/stripe/checkout`
- `/api/stripe/webhook`
- `/api/signed-download`
- `/api/cron/run?secret=...`
