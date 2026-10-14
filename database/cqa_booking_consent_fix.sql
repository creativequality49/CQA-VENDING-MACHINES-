-- Booking enquiries do not grant marketing consent.
-- Existing contact statuses and historical records remain unchanged.
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
    v_business_id, v_email, trim(p_customer_name), 'unsubscribed', 'booking',
    array['booking-lead'], jsonb_build_object('latest_booking_id', v_booking_id, 'machine_id', v_machine_id), now()
  )
  on conflict (business_id,email) do update set
    name = excluded.name,
    source = 'booking',
    tags = array(select distinct x from unnest(coalesce(cqa_contacts.tags,array[]::text[]) || array['booking-lead']) x),
    metadata = cqa_contacts.metadata || excluded.metadata,
    updated_at = now()
  returning id into v_contact_id;

  return query select v_booking_id, v_contact_id;
end;
$$;
