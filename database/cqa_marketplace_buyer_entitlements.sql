-- Apply through the reviewed Supabase migration workflow before deploying buyer-ID code.
-- Never expose service-role operations to the browser.
alter table public.cqa_orders
  add column if not exists buyer_user_id uuid references auth.users(id) on delete set null;

create index if not exists cqa_orders_buyer_paid_idx
  on public.cqa_orders (buyer_user_id, created_at desc)
  where status = 'paid';

-- Do not grant anonymous access to orders. Existing tenant RLS remains in force.
-- Old email-only orders intentionally remain unclaimed and cannot be downloaded.
