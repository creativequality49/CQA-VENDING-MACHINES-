-- CQA launch-hardening migration.
-- Owner onboarding is RLS-scoped, public forms use narrow security-definer RPCs,
-- and public checkout can read only a verified live checkout context.
-- Applied to production Supabase on 2026-10-03.

create or replace function public.cqa_create_business_workspace(
  p_name text, p_slug_base text, p_category text, p_description text,
  p_location text, p_phone text, p_email text, p_plan text
)
returns table (business_id uuid, existing boolean)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_business_id uuid;
  v_slug text;
begin
  if v_uid is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_plan not in ('starter','pro','elite') then raise exception 'invalid plan' using errcode = '22023'; end if;

  select b.id into v_business_id
  from public.cqa_businesses b
  where b.owner_id = v_uid
  order by b.created_at asc
  limit 1;

  if v_business_id is not null then
    return query select v_business_id, true;
    return;
  end if;

  v_slug := left(trim(both '-' from regexp_replace(lower(p_slug_base), '[^a-z0-9]+', '-', 'g')), 48)
            || '-' || left(replace(gen_random_uuid()::text, '-', ''), 8);

  insert into public.cqa_businesses (
    owner_id, name, slug, category, description, location_text, phone, email, plan, status
  ) values (
    v_uid, p_name, v_slug, p_category, p_description, p_location,
    nullif(p_phone, ''), lower(p_email), p_plan, 'review'
  )
  returning id into v_business_id;

  insert into public.cqa_machines (
    business_id, slug, title, subtitle, theme, status, assistant_enabled
  ) values (
    v_business_id,
    left(v_slug || '-machine-' || left(v_business_id::text, 6), 100),
    p_name || ' Machine',
    coalesce(nullif(p_description, ''), 'The official ' || p_name || ' digital vending machine.'),
    case when p_plan = 'elite' then 'gold' when p_plan = 'pro' then 'cyan' else 'pink' end,
    'review',
    true
  );

  return query select v_business_id, false;
end;
$$;

revoke all on function public.cqa_create_business_workspace(text,text,text,text,text,text,text,text) from public;
grant execute on function public.cqa_create_business_workspace(text,text,text,text,text,text,text,text) to authenticated;

drop policy if exists "cqa_accounts_owner_insert_pending" on public.cqa_connected_accounts;
create policy "cqa_accounts_owner_insert_pending"
on public.cqa_connected_accounts for insert to authenticated
with check (
  exists (
    select 1 from public.cqa_businesses b
    where b.id = cqa_connected_accounts.business_id
      and b.owner_id = (select auth.uid())
  )
  and charges_enabled = false
  and payouts_enabled = false
  and details_submitted = false
  and onboarding_complete = false
);

create or replace function public.cqa_public_checkout_context(p_machine_slug text, p_offer_id uuid)
returns table (
  machine_id uuid, machine_slug text, business_id uuid, business_name text,
  business_plan text, connected_account_id text, charges_enabled boolean,
  onboarding_complete boolean, offer_id uuid, offer_name text,
  offer_description text, offer_type text, price_cents integer,
  currency text, stripe_price_id text
)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.slug, b.id, b.name, b.plan, ca.stripe_account_id,
    ca.charges_enabled, ca.onboarding_complete, o.id, o.name, o.description,
    o.offer_type, o.price_cents, o.currency, o.stripe_price_id
  from public.cqa_machines m
  join public.cqa_businesses b on b.id = m.business_id
  join public.cqa_offers o on o.machine_id = m.id and o.business_id = b.id
  left join public.cqa_connected_accounts ca on ca.business_id = b.id
  where m.slug = p_machine_slug
    and m.status = 'live'
    and b.status = 'live'
    and o.id = p_offer_id
    and o.active = true
  limit 1;
$$;

revoke all on function public.cqa_public_checkout_context(text,uuid) from public;
grant execute on function public.cqa_public_checkout_context(text,uuid) to anon, authenticated;

create or replace function public.cqa_machine_subscribe(
  p_machine_slug text, p_email text, p_name text default null,
  p_source text default 'machine_optin', p_tags text[] default array[]::text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_machine_id uuid;
  v_contact_id uuid;
  v_email text := lower(trim(p_email));
  v_tags text[];
begin
  if length(v_email) < 5 or position('@' in v_email) < 2 then
    raise exception 'invalid email' using errcode = '22023';
  end if;

  select m.business_id, m.id into v_business_id, v_machine_id
  from public.cqa_machines m
  join public.cqa_businesses b on b.id = m.business_id
  where m.slug = p_machine_slug and m.status = 'live' and b.status = 'live'
  limit 1;

  if v_business_id is null then raise exception 'machine unavailable' using errcode = 'P0002'; end if;

  v_tags := array(
    select distinct left(trim(x), 40)
    from unnest(coalesce(p_tags, array[]::text[]) || array['subscriber']) x
    where length(trim(x)) between 1 and 40
    limit 10
  );

  insert into public.cqa_contacts (
    business_id, email, name, status, tags, source, metadata, updated_at
  ) values (
    v_business_id, v_email, nullif(trim(p_name), ''), 'subscribed',
    v_tags, left(coalesce(nullif(trim(p_source), ''), 'machine_optin'), 80),
    jsonb_build_object('machine_id', v_machine_id), now()
  )
  on conflict (business_id,email) do update set
    name = coalesce(excluded.name, cqa_contacts.name),
    status = 'subscribed',
    tags = excluded.tags,
    source = excluded.source,
    metadata = cqa_contacts.metadata || excluded.metadata,
    updated_at = now()
  returning id into v_contact_id;

  return v_contact_id;
end;
$$;

revoke all on function public.cqa_machine_subscribe(text,text,text,text,text[]) from public;
grant execute on function public.cqa_machine_subscribe(text,text,text,text,text[]) to anon, authenticated;

create or replace function public.cqa_machine_booking(
  p_machine_slug text, p_offer_id uuid, p_customer_name text,
  p_customer_email text, p_customer_phone text default null,
  p_notes text default null, p_requested_at timestamptz default null
)
returns table (booking_id uuid, contact_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_machine_id uuid;
  v_booking_id uuid;
  v_contact_id uuid;
  v_email text := lower(trim(p_customer_email));
begin
  if length(trim(p_customer_name)) < 2 or length(v_email) < 5 or position('@' in v_email) < 2 then
    raise exception 'invalid booking details' using errcode = '22023';
  end if;

  select m.business_id, m.id into v_business_id, v_machine_id
  from public.cqa_machines m
  join public.cqa_businesses b on b.id = m.business_id
  where m.slug = p_machine_slug and m.status = 'live' and b.status = 'live'
  limit 1;

  if v_business_id is null then raise exception 'machine unavailable' using errcode = 'P0002'; end if;

  if p_offer_id is not null and not exists (
    select 1 from public.cqa_offers o
    where o.id = p_offer_id and o.machine_id = v_machine_id
      and o.business_id = v_business_id and o.active = true
  ) then
    raise exception 'offer unavailable' using errcode = 'P0002';
  end if;

  if (
    select count(*) from public.cqa_bookings b
    where b.business_id = v_business_id
      and lower(b.customer_email) = v_email
      and b.created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'too many booking requests' using errcode = 'P0001';
  end if;

  insert into public.cqa_bookings (
    business_id, machine_id, offer_id, customer_name, customer_email,
    customer_phone, requested_at, notes, status
  ) values (
    v_business_id, v_machine_id, p_offer_id, trim(p_customer_name), v_email,
    nullif(trim(p_customer_phone), ''), p_requested_at, nullif(trim(p_notes), ''), 'requested'
  ) returning id into v_booking_id;

  insert into public.cqa_contacts (
    business_id, email, name, status, source, tags, metadata, updated_at
  ) values (
    v_business_id, v_email, trim(p_customer_name), 'subscribed', 'booking',
    array['booking-lead'], jsonb_build_object('latest_booking_id', v_booking_id, 'machine_id', v_machine_id), now()
  )
  on conflict (business_id,email) do update set
    name = excluded.name,
    status = 'subscribed',
    source = 'booking',
    tags = array(select distinct x from unnest(coalesce(cqa_contacts.tags,array[]::text[]) || array['booking-lead']) x),
    metadata = cqa_contacts.metadata || excluded.metadata,
    updated_at = now()
  returning id into v_contact_id;

  return query select v_booking_id, v_contact_id;
end;
$$;

revoke all on function public.cqa_machine_booking(text,uuid,text,text,text,text,timestamptz) from public;
grant execute on function public.cqa_machine_booking(text,uuid,text,text,text,text,timestamptz) to anon, authenticated;

create or replace function public.cqa_submit_sales_lead(
  p_name text, p_email text, p_phone text, p_business_name text,
  p_service text, p_quoted_price text, p_message text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_email text := lower(trim(p_email));
begin
  if length(trim(p_name)) < 2 or length(v_email) < 5 or position('@' in v_email) < 2
     or length(trim(p_message)) < 10 then
    raise exception 'invalid enquiry' using errcode = '22023';
  end if;

  if (
    select count(*) from public.cqa_sales_leads l
    where lower(l.email) = v_email and l.created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'too many enquiries' using errcode = 'P0001';
  end if;

  insert into public.cqa_sales_leads (
    name,email,phone,business_name,service,quoted_price,message,source,status,metadata
  ) values (
    trim(p_name),v_email,nullif(trim(p_phone),''),nullif(trim(p_business_name),''),
    left(coalesce(nullif(trim(p_service),''),'general'),120),nullif(trim(p_quoted_price),''),
    trim(p_message),'website','new','{}'::jsonb
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.cqa_submit_sales_lead(text,text,text,text,text,text,text) from public;
grant execute on function public.cqa_submit_sales_lead(text,text,text,text,text,text,text) to anon, authenticated;
