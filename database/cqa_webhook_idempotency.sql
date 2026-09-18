-- Marketplace Stripe webhook replay protection.
-- This table stays inaccessible through the Data API: only server code using
-- the Supabase service-role key may claim or complete webhook events.
alter table public.cqa_stripe_webhook_events
  add column if not exists status text not null default 'processing'
    check (status in ('processing', 'processed', 'failed')),
  add column if not exists last_error text;

alter table public.cqa_stripe_webhook_events enable row level security;

-- Deliberately grant no anon/authenticated policy. The Next.js server uses its
-- service-role key for webhook processing; browser clients must never read or
-- write payment-event state.
