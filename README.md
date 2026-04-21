# Creative Quality Australia – Digital Vending Machine System

Production-focused Next.js 15 SaaS starter for digital product vending:

- Landing page with CQA pricing tiers (Basic/Pro/Elite)
- Stripe Checkout flow (`/api/checkout`)
- Stripe Webhook processor (`/api/webhook`)
- Supabase-backed order + download token persistence
- Dashboard and Vault views for authenticated users
- Expiring secure download links (`/api/download/[token]`)

## Tech Stack

- Next.js 15 (App Router)
- Stripe API
- Supabase REST APIs (Postgres + Storage + Auth endpoint checks)
- Vercel-ready API and frontend routes

> Note: Tailwind package installation is blocked in this execution environment, so styling currently uses `app/globals.css` with a CQA black + neon pink theme.

## Environment Variables

Copy `.env.example` to `.env.local` and fill all values:

```bash
cp .env.example .env.local
```

Required keys:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_BASIC_PRICE_ID`
- `STRIPE_PRO_PRICE_ID`
- `STRIPE_ELITE_PRICE_ID`

## Supabase Setup

Run SQL from:

- `supabase/migrations/20260416_init_cqa_vending.sql`

Create storage bucket:

- `digital-products`

Upload files:

- `vault/basic.zip`
- `vault/pro.zip`
- `vault/elite.zip`

Insert product rows matching Stripe price IDs.

## Local Development

```bash
npm run dev
```

## Stripe Webhook (Local)

```bash
stripe listen --forward-to localhost:3000/api/webhook
```

Set `STRIPE_WEBHOOK_SECRET` from Stripe CLI output.

## Deployment on Vercel

1. Push this repo to GitHub.
2. Import into Vercel.
3. Add all env variables in Project Settings.
4. Set Stripe webhook endpoint to:
   - `https://<your-domain>/api/webhook`
5. Deploy and run end-to-end purchase test.

## End-to-End Flow

User -> Landing page -> Stripe Checkout -> Webhook -> Supabase orders/downloads -> Dashboard/Vault -> Secure token download
