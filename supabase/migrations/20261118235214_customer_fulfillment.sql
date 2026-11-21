-- Customer-owned order history and private, transactional service fulfilment.
-- Apply to the isolated test project first; production rollout is separate.
begin;

alter table public.cqa_orders add column if not exists purchase_snapshot jsonb not null default '{}'::jsonb
  check (jsonb_typeof(purchase_snapshot) = 'object');

update public.cqa_orders set customer_user_id = buyer_user_id
where customer_user_id is null and buyer_user_id is not null;

create index if not exists cqa_orders_customer_created_idx
  on public.cqa_orders (customer_user_id, created_at desc, id desc);

create table if not exists public.cqa_order_workspaces (
  order_id uuid primary key references public.cqa_orders(id) on delete cascade,
  business_id uuid not null references public.cqa_businesses(id) on delete cascade,
  state text not null default 'awaiting_intake'
    check (state in ('awaiting_intake', 'queued', 'in_progress', 'delivered')),
  intake jsonb not null default '{}'::jsonb check (jsonb_typeof(intake) = 'object'),
  delivery_message text not null default '' check (length(delivery_message) <= 10000),
  asset_key text,
  asset_name text check (length(asset_name) <= 200),
  asset_size integer check (asset_size > 0 and asset_size <= 4194304),
  asset_type text,
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cqa_order_workspaces_business_idx
  on public.cqa_order_workspaces (business_id, updated_at desc);

create table if not exists public.cqa_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.cqa_orders(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role text not null check (actor_role in ('buyer','owner')),
  kind text not null check (kind in ('intake_submitted','work_started','asset_attached','delivered')),
  message text not null check (length(message) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists cqa_order_events_order_created_idx
  on public.cqa_order_events (order_id, created_at desc, id desc);
create index if not exists cqa_order_events_actor_idx
  on public.cqa_order_events (actor_user_id);

-- These tables are reached only through authenticated server endpoints. They
-- allow owner-scoped reads only; browsers cannot write fulfilment state.
alter table public.cqa_order_workspaces enable row level security;
alter table public.cqa_order_events enable row level security;
revoke all on public.cqa_order_workspaces, public.cqa_order_events from public, anon, authenticated;
grant all on public.cqa_order_workspaces, public.cqa_order_events to service_role;
grant select on public.cqa_order_workspaces, public.cqa_order_events to authenticated;
create policy cqa_order_workspaces_owner_read on public.cqa_order_workspaces
  for select to authenticated using (
    exists (select 1 from public.cqa_businesses b join public.cqa_orders o on o.business_id = b.id
      where b.id = cqa_order_workspaces.business_id and o.id = cqa_order_workspaces.order_id
        and b.owner_id = (select auth.uid()))
  );
create policy cqa_order_events_owner_read on public.cqa_order_events
  for select to authenticated using (
    exists (select 1 from public.cqa_orders o join public.cqa_businesses b on b.id = o.business_id
      where o.id = cqa_order_events.order_id and b.owner_id = (select auth.uid()))
  );

create or replace function public.cqa_update_order_workspace(
  p_order_id uuid, p_actor_user_id uuid, p_action text,
  p_payload jsonb, p_expected_revision integer
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order public.cqa_orders%rowtype;
  v_workspace public.cqa_order_workspaces%rowtype;
  v_owner uuid;
  v_actor text;
  v_offer_type text;
  v_fulfillment_type text;
  v_event_kind text;
  v_event_message text;
  v_business_name text;
  v_goals text;
  v_details text;
  v_message text;
  v_asset_key text;
  v_asset_name text;
  v_asset_type text;
  v_asset_size integer;
begin
  if p_order_id is null or p_actor_user_id is null or p_expected_revision is null or p_expected_revision < 0
    or p_payload is null or jsonb_typeof(p_payload) <> 'object' or length(p_payload::text) > 18000 then
    raise exception 'Invalid fulfilment request' using errcode = '23514';
  end if;

  -- Serialise with payment reversals and other fulfilment actions. A refund
  -- cannot race a state transition into a new paid entitlement.
  select * into v_order from public.cqa_orders where id = p_order_id for update;
  if not found then raise exception 'Order unavailable' using errcode = 'P0002'; end if;
  select owner_id into v_owner from public.cqa_businesses where id = v_order.business_id;
  if v_owner = p_actor_user_id then v_actor := 'owner';
  elsif coalesce(v_order.customer_user_id, v_order.buyer_user_id) = p_actor_user_id then v_actor := 'buyer';
  else raise exception 'Order unavailable' using errcode = '42501'; end if;
  if v_order.status <> 'paid' then raise exception 'Payment is not active' using errcode = '23514'; end if;

  select offer_type, fulfillment_type into v_offer_type,v_fulfillment_type
    from public.cqa_offers where id = v_order.offer_id
      and business_id = v_order.business_id and machine_id = v_order.machine_id;
  if not found then raise exception 'Order offer unavailable' using errcode = 'P0002'; end if;
  if jsonb_typeof(v_order.purchase_snapshot->'title') = 'string'
    and length(btrim(v_order.purchase_snapshot->>'title')) > 0
    and length(v_order.purchase_snapshot->>'title') <= 300
    and v_order.purchase_snapshot->>'offerType' in ('service','booking','physical_product','digital_product','subscription','quote','consultation')
    and (jsonb_typeof(v_order.purchase_snapshot->'fulfillmentType') = 'null'
      or v_order.purchase_snapshot->>'fulfillmentType' in ('none','digital','shipping','booking','service','subscription','external')) then
    v_offer_type := v_order.purchase_snapshot->>'offerType';
    v_fulfillment_type := v_order.purchase_snapshot->>'fulfillmentType';
  end if;
  if v_offer_type = 'digital_product' or v_fulfillment_type = 'digital' then
    raise exception 'Digital products use protected library delivery' using errcode = '23514';
  end if;

  insert into public.cqa_order_workspaces (order_id,business_id)
    values (p_order_id,v_order.business_id) on conflict (order_id) do nothing;
  select * into v_workspace from public.cqa_order_workspaces where order_id = p_order_id for update;
  if v_workspace.business_id <> v_order.business_id then raise exception 'Order unavailable' using errcode = '42501'; end if;
  if v_workspace.revision <> p_expected_revision then
    raise exception 'Order changed; refresh and retry' using errcode = '40001';
  end if;

  if p_action = 'submit_intake' then
    if v_actor <> 'buyer' then raise exception 'Buyer action required' using errcode = '42501'; end if;
    if v_workspace.state not in ('awaiting_intake','queued') then raise exception 'Intake is already in progress' using errcode = '23514'; end if;
    v_business_name := btrim(coalesce(p_payload->>'businessName',''));
    v_goals := btrim(coalesce(p_payload->>'goals',''));
    v_details := btrim(coalesce(p_payload->>'details',''));
    if length(v_business_name) not between 1 and 160 or length(v_goals) not between 1 and 3000 or length(v_details) > 6000 then
      raise exception 'Complete the required intake fields' using errcode = '23514';
    end if;
    v_workspace.intake := jsonb_build_object('businessName',v_business_name,'goals',v_goals,'details',v_details);
    v_workspace.state := 'queued';
    v_event_kind := 'intake_submitted'; v_event_message := 'Customer brief received.';
  elsif p_action = 'start' then
    if v_actor <> 'owner' then raise exception 'Owner action required' using errcode = '42501'; end if;
    if v_workspace.state <> 'queued' then raise exception 'A submitted brief is required before work starts' using errcode = '23514'; end if;
    v_workspace.state := 'in_progress';
    v_event_kind := 'work_started'; v_event_message := 'The business has started work on this order.';
  elsif p_action = 'attach_asset' then
    if v_actor <> 'owner' then raise exception 'Owner action required' using errcode = '42501'; end if;
    if v_workspace.state <> 'in_progress' then raise exception 'Start work before attaching a delivery' using errcode = '23514'; end if;
    v_asset_key := p_payload->>'asset_key';
    v_asset_name := btrim(coalesce(p_payload->>'asset_name',''));
    v_asset_type := p_payload->>'asset_type';
    if coalesce(p_payload->>'asset_size','') !~ '^[0-9]{1,7}$' then raise exception 'Invalid delivery size' using errcode = '23514'; end if;
    v_asset_size := (p_payload->>'asset_size')::integer;
    if v_asset_key is null or v_asset_key not like 'fulfillment/' || v_order.business_id::text || '/' || v_order.id::text || '/%'
      or v_asset_key like '%..%' or v_asset_key ~ '[\\?#]'
      or length(v_asset_key) > 300 or length(v_asset_name) not between 1 and 200
      or v_asset_size not between 1 and 4194304
      or v_asset_type is null or v_asset_type not in ('application/pdf','application/zip','image/png','image/jpeg','text/plain') then
      raise exception 'Invalid private delivery' using errcode = '23514';
    end if;
    v_workspace.asset_key := v_asset_key; v_workspace.asset_name := v_asset_name;
    v_workspace.asset_size := v_asset_size; v_workspace.asset_type := v_asset_type;
    v_event_kind := 'asset_attached'; v_event_message := 'A private delivery file has been prepared.';
  elsif p_action = 'deliver' then
    if v_actor <> 'owner' then raise exception 'Owner action required' using errcode = '42501'; end if;
    if v_workspace.state <> 'in_progress' then raise exception 'Only in-progress orders can be delivered' using errcode = '23514'; end if;
    v_message := btrim(coalesce(p_payload->>'message',''));
    if length(v_message) > 10000 or (v_message = '' and v_workspace.asset_key is null) then
      raise exception 'Provide a delivery message or private file' using errcode = '23514';
    end if;
    v_workspace.delivery_message := v_message; v_workspace.state := 'delivered';
    v_event_kind := 'delivered'; v_event_message := 'Your order has been delivered.';
  else raise exception 'Unsupported fulfilment action' using errcode = '23514'; end if;

  update public.cqa_order_workspaces set state = v_workspace.state,
    intake = v_workspace.intake, delivery_message = v_workspace.delivery_message,
    asset_key = v_workspace.asset_key, asset_name = v_workspace.asset_name,
    asset_size = v_workspace.asset_size, asset_type = v_workspace.asset_type,
    revision = revision + 1, updated_at = now()
    where order_id = p_order_id returning * into v_workspace;
  insert into public.cqa_order_events (order_id,actor_user_id,actor_role,kind,message)
    values (p_order_id,p_actor_user_id,v_actor,v_event_kind,v_event_message);
  return jsonb_build_object('workspace',to_jsonb(v_workspace));
end;
$$;
revoke all on function public.cqa_update_order_workspace(uuid,uuid,text,jsonb,integer) from public,anon,authenticated;
grant execute on function public.cqa_update_order_workspace(uuid,uuid,text,jsonb,integer) to service_role;

comment on function public.cqa_update_order_workspace(uuid,uuid,text,jsonb,integer)
  is 'Server-only paid order transitions; endpoints must validate the actor with Supabase Auth before calling.';

commit;
