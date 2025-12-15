# Creative Quality Australia — AI Vending Machines (Phone-friendly deploy)

This repo is a production-ready starter for your **10 AI vending machines** with:
- Neon pink/black vending UI
- Stripe (one-time + subscriptions) + webhooks
- Admin panel to paste Stripe Price IDs
- Secure signed downloads (S3/R2)
- Automated drops (cron endpoint)

## 1) Local run (optional)
Requires Node 20+ and Postgres.

```bash
npm i
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

## 2) Stripe webhook locally (optional)
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```
Copy the `whsec_...` into `STRIPE_WEBHOOK_SECRET`.

## 3) Deploy on Render (recommended)
- Create a Web Service from this GitHub repo.
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Add environment variables from `.env.example` (DATABASE_URL from Neon).

## 4) Turn on automation (drops)
Create a Render Cron Job that calls:
`https://YOUR-RENDER-URL/api/cron/run?secret=CRON_SECRET`

Run daily (Adelaide time).

## 5) Stripe products/prices (one-time setup)
Create Stripe Prices:
- Tier 1/2: one-time AUD
- Tier 3A/3B: recurring monthly AUD
Then open `/admin/machines` and paste each Price ID.

