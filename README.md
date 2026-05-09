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
