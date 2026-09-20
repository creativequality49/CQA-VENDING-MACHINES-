-- CQA production completion: platform billing + persistent sales leads.
-- Plan/worker billing writes are server-only. Owners receive read-only access to their own billing state.

create table if not exists public.cqa_worker_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.cqa_businesses(id) on delete cascade,
  worker_id text not null,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  stripe_checkout_session_id text unique,
  status text not null default 'incomplete'
    check (status in ('incomplete','trialing','active','past_due','unpaid','cancelled','incomplete_expired')),
  price_cents integer not null check (price_cents >= 0),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, worker_id)
);

create index if not exists cqa_worker_subscriptions_business_idx
  on public.cqa_worker_subscriptions(business_id);
create index if not exists cqa_worker_subscriptions_status_idx
  on public.cqa_worker_subscriptions(status);

alter table public.cqa_worker_subscriptions enable row level security;
grant select on public.cqa_worker_subscriptions to authenticated;
revoke insert, update, delete on public.cqa_worker_subscriptions from authenticated, anon;

drop policy if exists "cqa_worker_subscriptions_owner_select" on public.cqa_worker_subscriptions;
create policy "cqa_worker_subscriptions_owner_select"
on public.cqa_worker_subscriptions
for select
to authenticated
using (
  exists (
    select 1
    from public.cqa_businesses b
    where b.id = cqa_worker_subscriptions.business_id
      and b.owner_id = (select auth.uid())
  )
);

-- Existing machine-plan subscriptions were server-written but had no owner read policy.
grant select on public.cqa_plan_subscriptions to authenticated;
revoke insert, update, delete on public.cqa_plan_subscriptions from authenticated, anon;

drop policy if exists "cqa_plan_subscriptions_owner_select" on public.cqa_plan_subscriptions;
create policy "cqa_plan_subscriptions_owner_select"
on public.cqa_plan_subscriptions
for select
to authenticated
using (
  exists (
    select 1
    from public.cqa_businesses b
    where b.id = cqa_plan_subscriptions.business_id
      and b.owner_id = (select auth.uid())
  )
);

-- A paid worker can no longer be self-enabled with the browser Supabase client.
drop policy if exists "cqa_business_workers_owner_insert" on public.cqa_business_workers;
drop policy if exists "cqa_business_workers_owner_update" on public.cqa_business_workers;
revoke insert, update, delete on public.cqa_business_workers from authenticated, anon;
grant select on public.cqa_business_workers to authenticated;

-- Persistent CQA sales pipeline for /contact.
create table if not exists public.cqa_sales_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  business_name text,
  service text not null default 'general',
  quoted_price text,
  message text not null,
  source text not null default 'website',
  status text not null default 'new'
    check (status in ('new','contacted','qualified','won','lost','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cqa_sales_leads_status_created_idx
  on public.cqa_sales_leads(status, created_at desc);
create index if not exists cqa_sales_leads_email_idx
  on public.cqa_sales_leads(lower(email));

alter table public.cqa_sales_leads enable row level security;
revoke all on public.cqa_sales_leads from anon, authenticated;
grant all on public.cqa_sales_leads to service_role;
