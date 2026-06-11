create extension if not exists pgcrypto;

create table if not exists public.subscription_tiers (
  id text primary key,
  name text not null,
  description text,
  price_cents integer not null default 0 check (price_cents >= 0),
  billing_interval text not null default 'one_time' check (billing_interval in ('one_time', 'month', 'year')),
  stripe_price_id text,
  features jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  content_type text not null default 'file' check (content_type in ('file', 'video', 'image', 'document', 'bundle_manifest', 'link')),
  machine_slug text,
  tier_key text references public.subscription_tiers(id) on update cascade on delete set null,
  asset_key text not null,
  storage_bucket text not null default 'content',
  file_name text,
  mime_type text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  checksum_sha256 text,
  status text not null default 'draft' check (status in ('draft', 'review', 'approved', 'published', 'archived')),
  subscriber_only boolean not null default false,
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_drops (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  machine_slug text,
  tier_key text references public.subscription_tiers(id) on update cascade on delete set null,
  subscriber_only boolean not null default true,
  release_at timestamptz not null,
  released_at timestamptz,
  status text not null default 'scheduled' check (status in ('draft', 'scheduled', 'released', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_drop_items (
  drop_id uuid not null references public.content_drops(id) on delete cascade,
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (drop_id, content_item_id)
);

create table if not exists public.content_reviews (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'changes_requested')),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_bundles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  machine_slug text,
  tier_key text references public.subscription_tiers(id) on update cascade on delete set null,
  product_id text,
  price_cents integer check (price_cents is null or price_cents >= 0),
  subscriber_only boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bundle_items (
  bundle_id uuid not null references public.content_bundles(id) on delete cascade,
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (bundle_id, content_item_id)
);

create table if not exists public.download_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  content_item_id uuid references public.content_items(id) on delete set null,
  bundle_id uuid references public.content_bundles(id) on delete set null,
  drop_id uuid references public.content_drops(id) on delete set null,
  product_id text,
  asset_key text not null,
  signed_url_expires_at timestamptz,
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  recipient text not null,
  template_key text not null,
  subject text,
  provider text,
  provider_message_id text,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'skipped')),
  related_drop_id uuid references public.content_drops(id) on delete set null,
  related_content_item_id uuid references public.content_items(id) on delete set null,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists public.content_analytics (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid references public.content_items(id) on delete cascade,
  drop_id uuid references public.content_drops(id) on delete cascade,
  bundle_id uuid references public.content_bundles(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('view', 'download', 'purchase', 'email_open', 'email_click', 'review')),
  session_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.customer_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  tier_key text references public.subscription_tiers(id) on update cascade on delete set null,
  machine_slug text,
  source text not null check (source in ('checkout', 'subscription', 'manual')),
  status text not null default 'active' check (status in ('active', 'inactive', 'expired', 'cancelled')),
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_checkout_session_id text,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, product_id, source)
);

create table if not exists public.stripe_events (
  id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

create index if not exists subscription_tiers_active_sort_idx on public.subscription_tiers(active, sort_order);
create index if not exists content_items_status_published_idx on public.content_items(status, published_at desc);
create index if not exists content_items_machine_slug_idx on public.content_items(machine_slug);
create index if not exists content_items_tier_key_idx on public.content_items(tier_key);
create index if not exists content_items_created_by_idx on public.content_items(created_by);
create index if not exists content_drops_release_status_idx on public.content_drops(status, release_at);
create index if not exists content_drops_machine_slug_idx on public.content_drops(machine_slug);
create index if not exists content_drops_tier_key_idx on public.content_drops(tier_key);
create index if not exists content_drop_items_content_item_idx on public.content_drop_items(content_item_id);
create index if not exists content_reviews_item_status_idx on public.content_reviews(content_item_id, status);
create index if not exists content_reviews_reviewer_idx on public.content_reviews(reviewer_id);
create index if not exists content_bundles_status_idx on public.content_bundles(status);
create index if not exists content_bundles_product_id_idx on public.content_bundles(product_id);
create index if not exists bundle_items_content_item_idx on public.bundle_items(content_item_id);
create index if not exists download_logs_user_created_idx on public.download_logs(user_id, created_at desc);
create index if not exists download_logs_asset_key_idx on public.download_logs(asset_key);
create index if not exists download_logs_content_item_idx on public.download_logs(content_item_id);
create index if not exists email_logs_recipient_created_idx on public.email_logs(recipient, created_at desc);
create index if not exists email_logs_status_idx on public.email_logs(status);
create index if not exists content_analytics_item_event_idx on public.content_analytics(content_item_id, event_type, created_at desc);
create index if not exists content_analytics_user_event_idx on public.content_analytics(user_id, event_type, created_at desc);
create index if not exists customer_entitlements_user_product_idx on public.customer_entitlements(user_id, product_id, status);
create index if not exists customer_entitlements_subscription_idx on public.customer_entitlements(stripe_subscription_id);
create index if not exists stripe_events_type_idx on public.stripe_events(event_type, processed_at desc);
