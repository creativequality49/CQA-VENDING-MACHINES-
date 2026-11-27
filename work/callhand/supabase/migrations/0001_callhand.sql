-- Callhand: AI receptionist for trades businesses.
--
-- Security model
-- - Every table has RLS. Signed-in users see only businesses they belong to.
-- - The browser can change very little directly: the owner's receptionist
--   settings and the "handled" mark on a call. Everything a call creates
--   (calls, captured details, alerts) is written by the server with the
--   service role from signed Twilio requests.
-- - Phone numbers are assigned by the operator (scripts/assign-number.ts), so
--   no business can claim a number and intercept another business's calls.

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  timezone text not null default 'Australia/Sydney',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index business_members_user_idx on public.business_members (user_id);

create table public.receptionist_settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  enabled boolean not null default false,
  assistant_name text not null default 'Sam' check (char_length(btrim(assistant_name)) between 1 and 40),
  greeting text not null check (char_length(btrim(greeting)) between 10 and 300),
  about text not null default '' check (char_length(about) <= 2000),
  services text not null default '' check (char_length(services) <= 2000),
  service_area text not null default '' check (char_length(service_area) <= 500),
  hours text not null default '' check (char_length(hours) <= 500),
  pricing_wording text not null default 'The team will give you a price once they know a bit more about the job.'
    check (char_length(btrim(pricing_wording)) between 10 and 300),
  callback_window text not null default 'within one business day'
    check (char_length(btrim(callback_window)) between 3 and 120),
  emergency_instructions text not null default '' check (char_length(emergency_instructions) <= 500),
  owner_alert_number text check (owner_alert_number ~ '^\+[1-9][0-9]{7,14}$'),
  updated_at timestamptz not null default now()
);

create table public.phone_numbers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  phone_number text not null unique check (phone_number ~ '^\+[1-9][0-9]{7,14}$'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index phone_numbers_business_idx on public.phone_numbers (business_id);

create table public.calls (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  call_sid text not null unique check (call_sid ~ '^CA[0-9a-fA-F]{32}$'),
  from_number text,
  to_number text,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'failed')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  -- What the receptionist captured. One call is one job enquiry.
  caller_name text check (char_length(caller_name) <= 120),
  callback_number text check (callback_number ~ '^\+[1-9][0-9]{7,14}$'),
  suburb text check (char_length(suburb) <= 120),
  job_type text check (char_length(job_type) <= 160),
  urgency text check (urgency in ('emergency', 'urgent', 'routine')),
  details text check (char_length(details) <= 2000),
  transcript jsonb not null default '[]'::jsonb check (jsonb_typeof(transcript) = 'array'),
  outcome text check (outcome in ('job_captured', 'no_details')),
  handled_at timestamptz,
  handled_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index calls_business_started_idx on public.calls (business_id, started_at desc);
create index calls_business_from_idx on public.calls (business_id, from_number, started_at desc);

create table public.alert_deliveries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  call_id uuid not null references public.calls(id) on delete cascade,
  kind text not null default 'owner_new_call' check (kind in ('owner_new_call')),
  recipient text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  detail text check (char_length(detail) <= 300),
  provider_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  -- At most one owner alert per call, however many times the call-end paths run.
  unique (call_id, kind)
);

-- ---------------------------------------------------------------------------
-- Membership helpers (security definer so policies can use them without
-- recursing into business_members' own policy).
-- ---------------------------------------------------------------------------

create function private.is_member(p_business uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.business_members m where m.business_id = p_business and m.user_id = auth.uid())
$$;

create function private.is_owner(p_business uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.business_members m where m.business_id = p_business and m.user_id = auth.uid() and m.role = 'owner')
$$;

grant usage on schema private to authenticated;
revoke all on function private.is_member(uuid), private.is_owner(uuid) from public;
grant execute on function private.is_member(uuid), private.is_owner(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Grants: deny by default, then allow the few browser writes there are.
-- (Supabase grants ALL on new public tables to anon and authenticated.)
-- ---------------------------------------------------------------------------

revoke all on public.businesses, public.business_members, public.receptionist_settings,
  public.phone_numbers, public.calls, public.alert_deliveries from anon, authenticated;

grant select on public.businesses, public.business_members, public.receptionist_settings,
  public.phone_numbers, public.calls, public.alert_deliveries to authenticated;

grant update (name) on public.businesses to authenticated;
grant update (enabled, assistant_name, greeting, about, services, service_area, hours, pricing_wording,
  callback_window, emergency_instructions, owner_alert_number, updated_at) on public.receptionist_settings to authenticated;
grant update (handled_at) on public.calls to authenticated;

alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.receptionist_settings enable row level security;
alter table public.phone_numbers enable row level security;
alter table public.calls enable row level security;
alter table public.alert_deliveries enable row level security;

create policy businesses_read on public.businesses for select to authenticated using (private.is_member(id));
create policy businesses_owner_update on public.businesses for update to authenticated
  using (private.is_owner(id)) with check (private.is_owner(id));

create policy members_read on public.business_members for select to authenticated using (private.is_member(business_id));

create policy settings_read on public.receptionist_settings for select to authenticated using (private.is_member(business_id));
create policy settings_owner_update on public.receptionist_settings for update to authenticated
  using (private.is_owner(business_id)) with check (private.is_owner(business_id));

create policy numbers_read on public.phone_numbers for select to authenticated using (private.is_member(business_id));

create policy calls_read on public.calls for select to authenticated using (private.is_member(business_id));
create policy calls_mark_handled on public.calls for update to authenticated
  using (private.is_member(business_id)) with check (private.is_member(business_id));

create policy alerts_read on public.alert_deliveries for select to authenticated using (private.is_member(business_id));

-- Who marked a call handled is recorded by the database, not supplied by the client.
create function private.stamp_handled_by() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.handled_at is distinct from old.handled_at then
    new.handled_by := case when new.handled_at is null then null else auth.uid() end;
  end if;
  return new;
end $$;
create trigger calls_stamp_handled_by before update of handled_at on public.calls
  for each row execute function private.stamp_handled_by();

-- ---------------------------------------------------------------------------
-- Signup: create the caller's business, owner membership and default settings.
-- ---------------------------------------------------------------------------

create function public.create_business(p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_business uuid;
begin
  if v_user is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  if char_length(v_name) not between 2 and 120 then
    raise exception 'Business name must be 2 to 120 characters' using errcode = '22023';
  end if;
  -- One business per account for now.
  if exists (select 1 from public.business_members where user_id = v_user) then
    raise exception 'This account already has a business' using errcode = '23505';
  end if;
  insert into public.businesses (name, created_by) values (v_name, v_user) returning id into v_business;
  insert into public.business_members (business_id, user_id, role) values (v_business, v_user, 'owner');
  insert into public.receptionist_settings (business_id, greeting)
  values (v_business, left('Thanks for calling ' || v_name || '.', 300));
  return v_business;
end $$;

revoke all on function public.create_business(text) from public, anon;
grant execute on function public.create_business(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Server-only call functions (service role).
-- ---------------------------------------------------------------------------

-- Merge what the receptionist captured into the call. Only non-empty values
-- overwrite, so a later partial save never erases an earlier answer.
create function public.merge_call_details(
  p_call_sid text,
  p_caller_name text default null,
  p_callback_number text default null,
  p_suburb text default null,
  p_job_type text default null,
  p_urgency text default null,
  p_details text default null
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_number text := regexp_replace(coalesce(p_callback_number, ''), '[^0-9+]', '', 'g');
  v_id uuid;
begin
  -- Australian local numbers (04xx..., 02...) become E.164; anything else invalid is dropped.
  if v_number ~ '^0[2-478][0-9]{8}$' then v_number := '+61' || substr(v_number, 2); end if;
  if v_number !~ '^\+[1-9][0-9]{7,14}$' then v_number := null; end if;

  update public.calls set
    caller_name = coalesce(nullif(left(btrim(coalesce(p_caller_name, '')), 120), ''), caller_name),
    callback_number = coalesce(v_number, callback_number),
    suburb = coalesce(nullif(left(btrim(coalesce(p_suburb, '')), 120), ''), suburb),
    job_type = coalesce(nullif(left(btrim(coalesce(p_job_type, '')), 160), ''), job_type),
    urgency = coalesce(case when lower(btrim(coalesce(p_urgency, ''))) in ('emergency', 'urgent', 'routine') then lower(btrim(p_urgency)) end, urgency),
    details = coalesce(nullif(left(btrim(coalesce(p_details, '')), 2000), ''), details)
  where call_sid = p_call_sid
  returning id into v_id;
  return v_id;
end $$;

-- Hands out the right to send a call's owner alert exactly once.
create function public.claim_call_alert(p_call_id uuid, p_recipient text) returns uuid
language sql security invoker set search_path = '' as $$
  insert into public.alert_deliveries (business_id, call_id, recipient)
  select c.business_id, c.id, p_recipient from public.calls c where c.id = p_call_id
  on conflict (call_id, kind) do nothing
  returning id;
$$;

revoke all on function public.merge_call_details(text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.claim_call_alert(uuid, text) from public, anon, authenticated;
grant execute on function public.merge_call_details(text, text, text, text, text, text, text) to service_role;
grant execute on function public.claim_call_alert(uuid, text) to service_role;
grant all on all tables in schema public to service_role;
