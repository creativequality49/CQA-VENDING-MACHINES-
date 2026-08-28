create extension if not exists pgcrypto;

create table if not exists public.fanx_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'fan' check (role in ('fan','creator','admin')),
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fanx_creators (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete set null,
  slug text not null unique,
  display_name text not null,
  handle text not null unique,
  bio text,
  avatar_url text,
  cover_url text,
  verified boolean not null default false,
  status text not null default 'active' check (status in ('draft','active','suspended')),
  stripe_account_id text,
  payout_mode text not null default 'platform_owned' check (payout_mode in ('platform_owned','stripe_connect')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fanx_tiers (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.fanx_creators(id) on delete cascade,
  name text not null,
  description text,
  price_cents integer not null check (price_cents >= 0),
  billing_interval text not null default 'month' check (billing_interval in ('month','year')),
  stripe_price_id text,
  perks jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fanx_posts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.fanx_creators(id) on delete cascade,
  title text,
  caption text,
  media_type text not null default 'image' check (media_type in ('image','video','audio','text')),
  media_url text,
  preview_url text,
  access_type text not null default 'free' check (access_type in ('free','subscriber','ppv')),
  price_cents integer not null default 0 check (price_cents >= 0),
  status text not null default 'published' check (status in ('draft','scheduled','published','archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fanx_products (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.fanx_creators(id) on delete cascade,
  slug text not null unique,
  title text not null,
  description text,
  cover_url text,
  asset_url text,
  product_type text not null default 'bundle' check (product_type in ('bundle','image_pack','video_pack','prompt_pack','digital')),
  price_cents integer not null check (price_cents >= 0),
  stripe_price_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fanx_follows (
  fan_user_id uuid not null references auth.users(id) on delete cascade,
  creator_id uuid not null references public.fanx_creators(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (fan_user_id, creator_id)
);

create table if not exists public.fanx_subscriptions (
  id uuid primary key default gen_random_uuid(),
  fan_user_id uuid not null references auth.users(id) on delete cascade,
  creator_id uuid not null references public.fanx_creators(id) on delete cascade,
  tier_id uuid not null references public.fanx_tiers(id) on delete restrict,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  status text not null default 'incomplete' check (status in ('trialing','active','past_due','unpaid','cancelled','incomplete','incomplete_expired')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(fan_user_id, tier_id)
);

create table if not exists public.fanx_orders (
  id uuid primary key default gen_random_uuid(),
  fan_user_id uuid not null references auth.users(id) on delete cascade,
  creator_id uuid not null references public.fanx_creators(id) on delete restrict,
  kind text not null check (kind in ('subscription','product','post','tip')),
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded','cancelled')),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  stripe_subscription_id text,
  currency text not null default 'aud',
  gross_cents integer not null default 0,
  platform_fee_cents integer not null default 0,
  creator_net_cents integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fanx_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.fanx_orders(id) on delete cascade,
  item_type text not null check (item_type in ('tier','product','post','tip')),
  item_id uuid,
  title text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_amount_cents integer not null default 0 check (unit_amount_cents >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.fanx_entitlements (
  id uuid primary key default gen_random_uuid(),
  fan_user_id uuid not null references auth.users(id) on delete cascade,
  creator_id uuid references public.fanx_creators(id) on delete cascade,
  content_type text not null check (content_type in ('creator_subscription','product','post')),
  content_id uuid not null,
  source_order_id uuid references public.fanx_orders(id) on delete set null,
  source_subscription_id uuid references public.fanx_subscriptions(id) on delete set null,
  status text not null default 'active' check (status in ('active','expired','revoked')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(fan_user_id, content_type, content_id)
);

create table if not exists public.fanx_earnings (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.fanx_creators(id) on delete cascade,
  order_id uuid references public.fanx_orders(id) on delete set null,
  earning_type text not null check (earning_type in ('subscription','product','post','tip','refund')),
  gross_cents integer not null,
  platform_fee_cents integer not null,
  creator_net_cents integer not null,
  currency text not null default 'aud',
  status text not null default 'available' check (status in ('pending','available','paid','reversed')),
  created_at timestamptz not null default now()
);

create table if not exists public.fanx_messages (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.fanx_creators(id) on delete cascade,
  fan_user_id uuid not null references auth.users(id) on delete cascade,
  sender_type text not null check (sender_type in ('fan','creator','ai')),
  body text not null,
  locked boolean not null default false,
  price_cents integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists fanx_posts_creator_published_idx on public.fanx_posts(creator_id, published_at desc);
create index if not exists fanx_products_creator_active_idx on public.fanx_products(creator_id, active);
create index if not exists fanx_subscriptions_fan_status_idx on public.fanx_subscriptions(fan_user_id, status);
create index if not exists fanx_subscriptions_creator_status_idx on public.fanx_subscriptions(creator_id, status);
create index if not exists fanx_orders_fan_created_idx on public.fanx_orders(fan_user_id, created_at desc);
create index if not exists fanx_orders_creator_created_idx on public.fanx_orders(creator_id, created_at desc);
create index if not exists fanx_earnings_creator_created_idx on public.fanx_earnings(creator_id, created_at desc);
create index if not exists fanx_entitlements_fan_status_idx on public.fanx_entitlements(fan_user_id, status);

alter table public.fanx_profiles enable row level security;
alter table public.fanx_creators enable row level security;
alter table public.fanx_tiers enable row level security;
alter table public.fanx_posts enable row level security;
alter table public.fanx_products enable row level security;
alter table public.fanx_follows enable row level security;
alter table public.fanx_subscriptions enable row level security;
alter table public.fanx_orders enable row level security;
alter table public.fanx_order_items enable row level security;
alter table public.fanx_entitlements enable row level security;
alter table public.fanx_earnings enable row level security;
alter table public.fanx_messages enable row level security;

create policy "fanx creators public read" on public.fanx_creators for select using (status='active');
create policy "fanx tiers public read" on public.fanx_tiers for select using (active=true);
create policy "fanx free posts public read" on public.fanx_posts for select using (status='published' and access_type='free');
create policy "fanx products public read" on public.fanx_products for select using (active=true);
create policy "fanx profile own read" on public.fanx_profiles for select using (auth.uid()=user_id);
create policy "fanx profile own update" on public.fanx_profiles for update using (auth.uid()=user_id);
create policy "fanx follows own" on public.fanx_follows for all using (auth.uid()=fan_user_id) with check (auth.uid()=fan_user_id);
create policy "fanx subscriptions own read" on public.fanx_subscriptions for select using (auth.uid()=fan_user_id);
create policy "fanx orders own read" on public.fanx_orders for select using (auth.uid()=fan_user_id);
create policy "fanx entitlements own read" on public.fanx_entitlements for select using (auth.uid()=fan_user_id);
create policy "fanx messages participant read" on public.fanx_messages for select using (auth.uid()=fan_user_id or exists(select 1 from public.fanx_creators c where c.id=creator_id and c.owner_user_id=auth.uid()));

create or replace function public.fanx_create_profile() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.fanx_profiles(user_id, role, display_name)
  values(new.id, coalesce(new.raw_user_meta_data->>'role','fan'), coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)))
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists fanx_auth_user_created on auth.users;
create trigger fanx_auth_user_created after insert on auth.users for each row execute function public.fanx_create_profile();

insert into public.fanx_creators(slug,display_name,handle,bio,avatar_url,cover_url,verified,status,payout_mode)
values
 ('scarlett-may','Scarlett May','@scarlettmay','Flagship FanXFantasy AI creator. Premium cinematic drops, private chat and creator bundles.','/fanx/mascot.png','/fanx/mascot.png',true,'active','platform_owned'),
 ('luna-everly','Luna Everly','@lunaeverly','Neon fantasy creator with premium image and video drops.',null,null,true,'active','platform_owned'),
 ('aria-monroe','Aria Monroe','@ariamonroe','Editorial AI creator focused on luxury lifestyle sets.',null,null,true,'active','platform_owned'),
 ('violet-rain','Violet Rain','@violetrain','Dark fantasy creator with exclusive subscriber drops.',null,null,true,'active','platform_owned')
on conflict (slug) do update set display_name=excluded.display_name, handle=excluded.handle, bio=excluded.bio, verified=excluded.verified, status=excluded.status;

insert into public.fanx_tiers(creator_id,name,description,price_cents,billing_interval,perks,sort_order)
select id,'Fan','Standard premium content',999,'month','["Premium feed","Saved library"]'::jsonb,1 from public.fanx_creators where slug='scarlett-may'
on conflict do nothing;
insert into public.fanx_tiers(creator_id,name,description,price_cents,billing_interval,perks,sort_order)
select id,'Premium','Full creator library + early access',1999,'month','["Full library","Early access","Priority messages"]'::jsonb,2 from public.fanx_creators where slug='scarlett-may'
on conflict do nothing;
insert into public.fanx_tiers(creator_id,name,description,price_cents,billing_interval,perks,sort_order)
select id,'VIP','Exclusive drops + private requests',4999,'month','["VIP drops","Private requests","Priority access"]'::jsonb,3 from public.fanx_creators where slug='scarlett-may'
on conflict do nothing;

insert into public.fanx_products(creator_id,slug,title,description,cover_url,asset_url,product_type,price_cents)
select id,'scarlett-collection','Scarlett Collection','Premium flagship creator bundle','/fanx/mascot.png',null,'bundle',2499 from public.fanx_creators where slug='scarlett-may'
on conflict (slug) do nothing;
insert into public.fanx_products(creator_id,slug,title,description,cover_url,asset_url,product_type,price_cents)
select id,'creator-prompt-vault','Creator Prompt Vault','Character-consistent prompt system','/fanx/logo.png',null,'prompt_pack',999 from public.fanx_creators where slug='scarlett-may'
on conflict (slug) do nothing;

insert into public.fanx_posts(creator_id,title,caption,media_type,preview_url,access_type,price_cents,status,published_at)
select id,'Welcome to Scarlett','Free public preview from Scarlett May.','image','/fanx/mascot.png','free',0,'published',now() from public.fanx_creators where slug='scarlett-may' and not exists(select 1 from public.fanx_posts p where p.creator_id=fanx_creators.id and p.title='Welcome to Scarlett');
insert into public.fanx_posts(creator_id,title,caption,media_type,preview_url,access_type,price_cents,status,published_at)
select id,'Neon After Dark','Premium subscriber drop.','image','/fanx/mascot.png','subscriber',0,'published',now() from public.fanx_creators where slug='scarlett-may' and not exists(select 1 from public.fanx_posts p where p.creator_id=fanx_creators.id and p.title='Neon After Dark');