-- CQA Business-in-a-Box onboarding, machine media and integration foundation.

create table if not exists public.cqa_machine_setup_profiles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.cqa_businesses(id) on delete cascade,
  setup_mode text not null default 'guided'
    check (setup_mode in ('shell','guided','assisted','done_for_you')),
  setup_status text not null default 'questionnaire'
    check (setup_status in ('questionnaire','in_progress','generated','review','complete')),
  abn text,
  legal_name text,
  business_structure text,
  sales_model text[] not null default '{}',
  fulfillment_model text[] not null default '{}',
  shipping_regions text[] not null default '{}',
  audience text,
  brand_direction text,
  primary_color text,
  secondary_color text,
  design_notes text,
  business_summary text,
  answers jsonb not null default '{}'::jsonb,
  ai_draft jsonb not null default '{}'::jsonb,
  completed_steps text[] not null default '{}',
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cqa_machine_setup_profiles enable row level security;
grant select, insert, update on public.cqa_machine_setup_profiles to authenticated;
revoke delete on public.cqa_machine_setup_profiles from authenticated, anon;

drop policy if exists "cqa_machine_setup_owner_select" on public.cqa_machine_setup_profiles;
create policy "cqa_machine_setup_owner_select"
on public.cqa_machine_setup_profiles for select to authenticated
using (exists (
  select 1 from public.cqa_businesses b
  where b.id = cqa_machine_setup_profiles.business_id
    and b.owner_id = (select auth.uid())
));

drop policy if exists "cqa_machine_setup_owner_insert" on public.cqa_machine_setup_profiles;
create policy "cqa_machine_setup_owner_insert"
on public.cqa_machine_setup_profiles for insert to authenticated
with check (exists (
  select 1 from public.cqa_businesses b
  where b.id = cqa_machine_setup_profiles.business_id
    and b.owner_id = (select auth.uid())
));

drop policy if exists "cqa_machine_setup_owner_update" on public.cqa_machine_setup_profiles;
create policy "cqa_machine_setup_owner_update"
on public.cqa_machine_setup_profiles for update to authenticated
using (exists (
  select 1 from public.cqa_businesses b
  where b.id = cqa_machine_setup_profiles.business_id
    and b.owner_id = (select auth.uid())
))
with check (exists (
  select 1 from public.cqa_businesses b
  where b.id = cqa_machine_setup_profiles.business_id
    and b.owner_id = (select auth.uid())
));

create table if not exists public.cqa_machine_assets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.cqa_businesses(id) on delete cascade,
  machine_id uuid references public.cqa_machines(id) on delete cascade,
  offer_id uuid references public.cqa_offers(id) on delete cascade,
  kind text not null default 'product'
    check (kind in ('logo','hero','product','gallery','document')),
  storage_path text not null,
  public_url text,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists cqa_machine_assets_business_idx
  on public.cqa_machine_assets(business_id, kind, sort_order);

alter table public.cqa_machine_assets enable row level security;
grant select, insert, update, delete on public.cqa_machine_assets to authenticated;

drop policy if exists "cqa_machine_assets_owner_all" on public.cqa_machine_assets;
create policy "cqa_machine_assets_owner_all"
on public.cqa_machine_assets for all to authenticated
using (exists (
  select 1 from public.cqa_businesses b
  where b.id = cqa_machine_assets.business_id
    and b.owner_id = (select auth.uid())
))
with check (exists (
  select 1 from public.cqa_businesses b
  where b.id = cqa_machine_assets.business_id
    and b.owner_id = (select auth.uid())
));

alter table public.cqa_offers
  add column if not exists source_provider text not null default 'manual',
  add column if not exists source_external_id text,
  add column if not exists fulfillment_type text not null default 'none',
  add column if not exists shipping_required boolean not null default false,
  add column if not exists inventory_tracking boolean not null default false,
  add column if not exists inventory_quantity integer,
  add column if not exists image_url text,
  add column if not exists external_url text,
  add column if not exists fulfillment_config jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname='cqa_offers_fulfillment_type_check'
  ) then
    alter table public.cqa_offers add constraint cqa_offers_fulfillment_type_check
      check (fulfillment_type in ('none','digital','shipping','booking','service','subscription','external'));
  end if;
end $$;

create unique index if not exists cqa_business_connections_provider_unique
  on public.cqa_business_connections(business_id, provider);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cqa-machine-media',
  'cqa-machine-media',
  true,
  10485760,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "cqa_machine_media_owner_insert" on storage.objects;
create policy "cqa_machine_media_owner_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'cqa-machine-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "cqa_machine_media_owner_update" on storage.objects;
create policy "cqa_machine_media_owner_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'cqa-machine-media'
  and owner_id = (select auth.uid()::text)
)
with check (
  bucket_id = 'cqa-machine-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "cqa_machine_media_owner_delete" on storage.objects;
create policy "cqa_machine_media_owner_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'cqa-machine-media'
  and owner_id = (select auth.uid()::text)
);

drop policy if exists "cqa_machine_media_public_read" on storage.objects;
create policy "cqa_machine_media_public_read"
on storage.objects for select to anon, authenticated
using (bucket_id = 'cqa-machine-media');
