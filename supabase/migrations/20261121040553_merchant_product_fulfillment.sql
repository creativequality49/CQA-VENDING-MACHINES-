-- Merchant products: atomic stock holds, paid fulfilment ledger and shipments.
-- Service-role RPCs only. Never reclaim a hold from its timestamp alone: a
-- signed provider expiry/failure or a confirmed checkout-create failure is required.
begin;

alter table public.cqa_offers add column if not exists product_revision integer not null default 0;
do $$ begin
  if not exists(select 1 from pg_constraint where conname='cqa_offers_product_stock_nonnegative') then
    alter table public.cqa_offers add constraint cqa_offers_product_stock_nonnegative
      check (inventory_quantity is null or inventory_quantity >= 0) not valid;
  end if;
end $$;

create table public.cqa_inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null unique,
  business_id uuid not null references public.cqa_businesses(id),
  machine_id uuid not null references public.cqa_machines(id),
  offer_id uuid not null references public.cqa_offers(id),
  buyer_user_id uuid references auth.users(id) on delete set null,
  quantity integer not null check (quantity between 1 and 100),
  inventory_tracked boolean not null,
  offer_snapshot jsonb not null check (jsonb_typeof(offer_snapshot)='object'),
  state text not null default 'reserved' check (state in ('reserved','committed','released')),
  stripe_checkout_session_id text unique,
  order_id uuid unique references public.cqa_orders(id),
  expires_at timestamptz not null default now()+interval '35 minutes',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cqa_inventory_reserved_offer_idx on public.cqa_inventory_reservations(offer_id)
  where state='reserved' and inventory_tracked;
create index cqa_inventory_reservations_business_idx on public.cqa_inventory_reservations(business_id,created_at desc);
create index cqa_inventory_reservations_machine_idx on public.cqa_inventory_reservations(machine_id);
create index cqa_inventory_reservations_buyer_idx on public.cqa_inventory_reservations(buyer_user_id);

create table public.cqa_product_fulfillment_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.cqa_orders(id),
  business_id uuid not null references public.cqa_businesses(id),
  kind text not null check (kind in ('digital_access','physical_shipment')),
  state text not null check (state in ('queued','processing','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cqa_product_jobs_business_state_idx on public.cqa_product_fulfillment_jobs(business_id,state,created_at);

create table public.cqa_order_shipments (
  order_id uuid primary key references public.cqa_orders(id),
  business_id uuid not null references public.cqa_businesses(id),
  state text not null default 'ready' check (state in ('ready','packing','shipped','delivered','cancelled')),
  shipping_address jsonb not null check (jsonb_typeof(shipping_address)='object'),
  carrier text check (length(carrier)<=100),
  tracking_number text check (length(tracking_number)<=200),
  tracking_url text check (length(tracking_url)<=2000),
  revision integer not null default 0 check (revision>=0),
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cqa_order_shipments_business_state_idx on public.cqa_order_shipments(business_id,state,updated_at desc);

alter table public.cqa_inventory_reservations enable row level security;
alter table public.cqa_product_fulfillment_jobs enable row level security;
alter table public.cqa_order_shipments enable row level security;
revoke all on public.cqa_inventory_reservations,public.cqa_product_fulfillment_jobs,public.cqa_order_shipments from public,anon,authenticated;
grant all on public.cqa_inventory_reservations,public.cqa_product_fulfillment_jobs,public.cqa_order_shipments to service_role;
grant select on public.cqa_inventory_reservations,public.cqa_product_fulfillment_jobs,public.cqa_order_shipments to authenticated;
create policy cqa_inventory_owner_read on public.cqa_inventory_reservations for select to authenticated
  using (exists(select 1 from public.cqa_businesses b where b.id=business_id and b.owner_id=(select auth.uid())));
create policy cqa_product_jobs_owner_read on public.cqa_product_fulfillment_jobs for select to authenticated
  using (exists(select 1 from public.cqa_businesses b where b.id=business_id and b.owner_id=(select auth.uid())));
create policy cqa_shipments_owner_read on public.cqa_order_shipments for select to authenticated
  using (exists(select 1 from public.cqa_businesses b where b.id=business_id and b.owner_id=(select auth.uid())));

-- Keep browser updates from bypassing stock/revision RPCs. Offer-row locks
-- serialize reservations, stock adjustments and settlement. Existing metadata
-- editing remains supported; every update invalidates stale product forms.
create function public.cqa_guard_product_inventory() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_reserved bigint;
begin
  if TG_OP='INSERT' then
    if current_user not in ('service_role','postgres','supabase_admin') and new.product_revision<>0 then
      raise exception 'Product revisions are server managed' using errcode='42501';
    end if;
    if new.inventory_tracking and (new.inventory_quantity is null or new.inventory_quantity<0) then
      raise exception 'Tracked products require nonnegative stock' using errcode='23514';
    end if;
    return new;
  end if;
  if current_user not in ('service_role','postgres','supabase_admin') and
    (new.inventory_quantity is distinct from old.inventory_quantity or
     new.inventory_tracking is distinct from old.inventory_tracking or
     new.product_revision is distinct from old.product_revision) then
    raise exception 'Inventory changes require the merchant server endpoint' using errcode='42501';
  end if;
  select coalesce(sum(quantity),0) into v_reserved from public.cqa_inventory_reservations
    where offer_id=old.id and state='reserved' and inventory_tracked;
  if new.inventory_tracking is distinct from old.inventory_tracking and exists(
    select 1 from public.cqa_inventory_reservations where offer_id=old.id and state='reserved') then
    raise exception 'Resolve checkout reservations before changing inventory tracking' using errcode='23514';
  end if;
  if new.inventory_tracking and (new.inventory_quantity is null or new.inventory_quantity<v_reserved) then
    raise exception 'Stock cannot be lower than active checkout reservations' using errcode='23514';
  end if;
  if (new.offer_type is distinct from old.offer_type or new.fulfillment_type is distinct from old.fulfillment_type
      or new.business_id is distinct from old.business_id or new.machine_id is distinct from old.machine_id)
    and (exists(select 1 from public.cqa_inventory_reservations where offer_id=old.id and state in ('reserved','committed'))
      or exists(select 1 from public.cqa_orders where offer_id=old.id and status in ('pending','paid'))) then
    raise exception 'Purchased product identity is immutable; archive and create a new product' using errcode='23514';
  end if;
  new.product_revision := old.product_revision+1;
  return new;
end $$;
revoke all on function public.cqa_guard_product_inventory() from public,anon,authenticated;
create trigger cqa_product_inventory_guard before insert or update on public.cqa_offers
  for each row execute function public.cqa_guard_product_inventory();

create function public.cqa_reserve_inventory(p_offer_id uuid,p_buyer_user_id uuid,p_idempotency_key uuid,p_quantity integer default 1)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_offer public.cqa_offers%rowtype; v_res public.cqa_inventory_reservations%rowtype;
  v_reserved bigint; v_shipping jsonb; v_terms jsonb; v_config jsonb;
begin
  if p_offer_id is null or p_idempotency_key is null or p_quantity is null or p_quantity not between 1 and 100 then
    raise exception 'Invalid stock reservation' using errcode='23514'; end if;
  select * into v_offer from public.cqa_offers where id=p_offer_id for update;
  if not found then raise exception 'Product unavailable' using errcode='P0002'; end if;
  select * into v_res from public.cqa_inventory_reservations where idempotency_key=p_idempotency_key for update;
  if found then
    if v_res.offer_id<>p_offer_id or v_res.buyer_user_id is distinct from p_buyer_user_id or v_res.quantity<>p_quantity then
      raise exception 'Checkout idempotency key has another purchase contract' using errcode='40001'; end if;
    return jsonb_build_object('reservation',to_jsonb(v_res));
  end if;
  if not v_offer.active or (v_offer.offer_type not in ('physical_product','digital_product') and v_offer.fulfillment_type not in ('shipping','digital')) then
    raise exception 'Product unavailable' using errcode='23514'; end if;
  if v_offer.offer_type='physical_product' and not v_offer.inventory_tracking then
    raise exception 'Physical products require tracked stock' using errcode='23514'; end if;
  if v_offer.inventory_tracking then
    select coalesce(sum(quantity),0) into v_reserved from public.cqa_inventory_reservations
      where offer_id=p_offer_id and state='reserved' and inventory_tracked;
    if v_offer.inventory_quantity is null or v_offer.inventory_quantity-v_reserved<p_quantity then
      raise exception 'Insufficient stock' using errcode='23514'; end if;
  end if;
  v_config:=coalesce(v_offer.fulfillment_config,'{}'::jsonb);
  v_shipping:=jsonb_build_object('supportedRegions',coalesce(v_config->'shipping'->'supportedRegions','["AU"]'::jsonb),
    'flatFeeCents',coalesce(v_config->'shipping'->'flatFeeCents','0'::jsonb),
    'dispatchTiming',coalesce(v_config->'shipping'->>'dispatchTiming',''));
  v_terms:=jsonb_build_object('deliveryDescription',coalesce(v_config->>'deliveryDescription',''),
    'deliveryTiming',coalesce(v_config->>'deliveryTiming',''),'supportDetails',coalesce(v_config->>'supportDetails',''),
    'refundTerms',coalesce(v_config->>'refundTerms',''));
  insert into public.cqa_inventory_reservations(idempotency_key,business_id,machine_id,offer_id,buyer_user_id,quantity,inventory_tracked,offer_snapshot)
    values(p_idempotency_key,v_offer.business_id,v_offer.machine_id,v_offer.id,p_buyer_user_id,p_quantity,v_offer.inventory_tracking,
      jsonb_build_object('title',v_offer.name,'offerType',v_offer.offer_type,'fulfillmentType',v_offer.fulfillment_type,
        'shippingRequired',v_offer.shipping_required,'inventoryTracked',v_offer.inventory_tracking,
        'priceCents',v_offer.price_cents,'currency',v_offer.currency,'shipping',v_shipping,'terms',v_terms,
        'fulfillmentConfig',v_terms||jsonb_build_object('provider','merchant','shipping',v_shipping))) returning * into v_res;
  return jsonb_build_object('reservation',to_jsonb(v_res));
end $$;

create function public.cqa_bind_inventory_reservation(p_reservation_id uuid,p_checkout_session_id text,p_order_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_res public.cqa_inventory_reservations%rowtype; v_order public.cqa_orders%rowtype;
begin
  if p_checkout_session_id is null or p_checkout_session_id !~ '^cs_[A-Za-z0-9_]+$' then
    raise exception 'Invalid checkout binding' using errcode='23514'; end if;
  select * into v_order from public.cqa_orders where id=p_order_id for update;
  if not found then raise exception 'Order unavailable' using errcode='P0002'; end if;
  select * into v_res from public.cqa_inventory_reservations where id=p_reservation_id;
  if not found then raise exception 'Reservation unavailable' using errcode='P0002'; end if;
  perform 1 from public.cqa_offers where id=v_res.offer_id for update;
  select * into v_res from public.cqa_inventory_reservations where id=p_reservation_id for update;
  if v_res.stripe_checkout_session_id=p_checkout_session_id and v_res.order_id=p_order_id then
    return jsonb_build_object('reservation',to_jsonb(v_res)); end if;
  if v_res.state<>'reserved' or v_res.stripe_checkout_session_id is not null or v_res.order_id is not null
    or v_order.status<>'pending' or v_order.stripe_checkout_session_id is distinct from p_checkout_session_id
    or v_order.business_id<>v_res.business_id or v_order.machine_id is distinct from v_res.machine_id
    or v_order.offer_id is distinct from v_res.offer_id
    or coalesce(v_order.customer_user_id,v_order.buyer_user_id) is distinct from v_res.buyer_user_id
    or v_order.currency is distinct from v_res.offer_snapshot->>'currency'
    or v_order.amount_cents is distinct from ((v_res.offer_snapshot->>'priceCents')::integer*v_res.quantity + case when v_res.offer_snapshot->>'offerType'='physical_product' then coalesce((v_res.offer_snapshot->'shipping'->>'flatFeeCents')::integer,0) else 0 end)
    or v_order.purchase_snapshot->>'offerType' is distinct from v_res.offer_snapshot->>'offerType'
    or v_order.purchase_snapshot->>'fulfillmentType' is distinct from v_res.offer_snapshot->>'fulfillmentType' then
    raise exception 'Reservation does not match its durable order contract' using errcode='23514'; end if;
  update public.cqa_inventory_reservations set stripe_checkout_session_id=p_checkout_session_id,order_id=p_order_id,updated_at=now()
    where id=p_reservation_id returning * into v_res;
  return jsonb_build_object('reservation',to_jsonb(v_res));
end $$;

create function public.cqa_release_inventory_reservation(p_reservation_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_res public.cqa_inventory_reservations%rowtype;
begin
  select * into v_res from public.cqa_inventory_reservations where id=p_reservation_id;
  if not found then return jsonb_build_object('reservation',null); end if;
  perform 1 from public.cqa_offers where id=v_res.offer_id for update;
  select * into v_res from public.cqa_inventory_reservations where id=p_reservation_id for update;
  if v_res.state<>'reserved' then return jsonb_build_object('reservation',to_jsonb(v_res)); end if;
  if v_res.order_id is not null or v_res.stripe_checkout_session_id is not null then
    raise exception 'Bound checkout requires a verified provider outcome' using errcode='23514'; end if;
  update public.cqa_inventory_reservations set state='released',updated_at=now() where id=p_reservation_id returning * into v_res;
  return jsonb_build_object('reservation',to_jsonb(v_res));
end $$;

create function public.cqa_settle_inventory_reservation(p_checkout_session_id text,p_action text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_res public.cqa_inventory_reservations%rowtype; v_order public.cqa_orders%rowtype;
begin
  if p_action not in ('commit','release') or p_action is null then raise exception 'Invalid reservation outcome' using errcode='23514'; end if;
  select * into v_res from public.cqa_inventory_reservations where stripe_checkout_session_id=p_checkout_session_id;
  if not found then return jsonb_build_object('reservation',null); end if;
  select * into v_order from public.cqa_orders where id=v_res.order_id for update;
  if not found then raise exception 'Bound order unavailable' using errcode='P0002'; end if;
  perform 1 from public.cqa_offers where id=v_res.offer_id for update;
  select * into v_res from public.cqa_inventory_reservations where id=v_res.id for update;
  if v_order.stripe_checkout_session_id is distinct from p_checkout_session_id or v_order.business_id<>v_res.business_id
    or v_order.offer_id is distinct from v_res.offer_id or v_order.machine_id is distinct from v_res.machine_id then
    raise exception 'Checkout reservation contract mismatch' using errcode='23514'; end if;
  if p_action='commit' then
    if v_order.status<>'paid' then raise exception 'Only verified paid orders consume stock' using errcode='23514'; end if;
    if v_res.state='released' then raise exception 'Released reservation requires payment review' using errcode='23514'; end if;
    if v_res.state='reserved' then
      update public.cqa_inventory_reservations set state='committed',updated_at=now() where id=v_res.id returning * into v_res;
      if v_res.inventory_tracked then
        update public.cqa_offers set inventory_quantity=inventory_quantity-v_res.quantity where id=v_res.offer_id
          and inventory_tracking and inventory_quantity>=v_res.quantity;
        if not found then raise exception 'Reserved stock changed; payment review required' using errcode='23514'; end if;
      end if;
    end if;
  elsif v_res.state='reserved' then
    if v_order.status='paid' then raise exception 'Paid reservations cannot be released' using errcode='23514'; end if;
    update public.cqa_inventory_reservations set state='released',updated_at=now() where id=v_res.id returning * into v_res;
  end if;
  -- Refunds never restock committed goods automatically. Returned stock requires
  -- a separate explicit merchant inventory adjustment.
  return jsonb_build_object('reservation',to_jsonb(v_res));
end $$;

create function public.cqa_guard_reserved_product_payment() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_res public.cqa_inventory_reservations%rowtype; v_physical boolean;
begin
  if new.status<>'paid' or (TG_OP='UPDATE' and old.status='paid') then return new; end if;
  v_physical:=coalesce(new.purchase_snapshot->>'offerType'='physical_product'
    or new.purchase_snapshot->>'fulfillmentType'='shipping',false);
  select * into v_res from public.cqa_inventory_reservations where order_id=new.id or stripe_checkout_session_id=new.stripe_checkout_session_id limit 1;
  if not found then
    if v_physical then raise exception 'Physical payment has no durable reservation' using errcode='23514'; end if;
    return new;
  end if;
  perform 1 from public.cqa_offers where id=v_res.offer_id for update;
  select * into v_res from public.cqa_inventory_reservations where id=v_res.id for update;
  if v_res.state not in ('reserved','committed') or v_res.order_id is distinct from new.id
    or v_res.stripe_checkout_session_id is distinct from new.stripe_checkout_session_id
    or v_res.business_id<>new.business_id or v_res.machine_id is distinct from new.machine_id or v_res.offer_id is distinct from new.offer_id then
    raise exception 'Physical payment reservation is not valid' using errcode='23514'; end if;
  return new;
end $$;
revoke all on function public.cqa_guard_reserved_product_payment() from public,anon,authenticated;
create trigger cqa_reserved_product_payment_guard before insert or update of status on public.cqa_orders
  for each row execute function public.cqa_guard_reserved_product_payment();

create function public.cqa_record_product_fulfillment(p_order_id uuid,p_checkout_session_id text,p_shipping_address jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_order public.cqa_orders%rowtype; v_offer public.cqa_offers%rowtype;
  v_res public.cqa_inventory_reservations%rowtype; v_job public.cqa_product_fulfillment_jobs%rowtype;
  v_shipment public.cqa_order_shipments%rowtype; v_snapshot jsonb; v_kind text; v_address jsonb; v_settled jsonb;
begin
  select * into v_order from public.cqa_orders where id=p_order_id for update;
  if not found then raise exception 'Order unavailable' using errcode='P0002'; end if;
  if v_order.status<>'paid' or v_order.stripe_checkout_session_id is distinct from p_checkout_session_id then
    raise exception 'Verified paid checkout required' using errcode='23514'; end if;
  select * into v_offer from public.cqa_offers where id=v_order.offer_id and business_id=v_order.business_id and machine_id=v_order.machine_id;
  if not found then raise exception 'Product unavailable' using errcode='P0002'; end if;
  v_snapshot:=v_order.purchase_snapshot;
  if jsonb_typeof(v_snapshot->'title') is distinct from 'string' or btrim(coalesce(v_snapshot->>'title',''))=''
    or v_snapshot->>'offerType' not in ('service','booking','physical_product','digital_product','subscription','quote','consultation') then
    v_snapshot:=jsonb_build_object('offerType',v_offer.offer_type,'fulfillmentType',v_offer.fulfillment_type);
  end if;
  if v_snapshot->>'offerType'='digital_product' or v_snapshot->>'fulfillmentType'='digital' then v_kind:='digital_access';
  elsif v_snapshot->>'offerType'='physical_product' or v_snapshot->>'fulfillmentType'='shipping' then v_kind:='physical_shipment';
  else return jsonb_build_object('job',null,'shipment',null,'reservation',null); end if;
  select * into v_res from public.cqa_inventory_reservations where order_id=p_order_id;
  if v_kind='physical_shipment' and not found then raise exception 'Physical payment has no durable reservation' using errcode='23514'; end if;
  if v_res.id is not null then
    if v_res.offer_snapshot->>'offerType' is distinct from v_snapshot->>'offerType'
      or v_res.offer_snapshot->>'fulfillmentType' is distinct from v_snapshot->>'fulfillmentType' then
      raise exception 'Purchased product classification changed' using errcode='23514'; end if;
    v_settled:=public.cqa_settle_inventory_reservation(p_checkout_session_id,'commit');
    select * into v_res from public.cqa_inventory_reservations where order_id=p_order_id;
  end if;
  if v_kind='physical_shipment' then
    if p_shipping_address is null or jsonb_typeof(p_shipping_address)<>'object' or length(p_shipping_address::text)>5000 then
      raise exception 'Verified shipping address required' using errcode='23514'; end if;
    v_address:=jsonb_build_object('name',btrim(coalesce(p_shipping_address->>'name','')),
      'line1',btrim(coalesce(p_shipping_address->>'line1','')),'line2',btrim(coalesce(p_shipping_address->>'line2','')),
      'city',btrim(coalesce(p_shipping_address->>'city','')),'state',btrim(coalesce(p_shipping_address->>'state','')),
      'postal_code',btrim(coalesce(p_shipping_address->>'postal_code','')),'country',upper(btrim(coalesce(p_shipping_address->>'country',''))));
    if length(v_address->>'name') not between 1 and 200 or length(v_address->>'line1') not between 1 and 300
      or length(v_address->>'city') not between 1 and 150 or length(v_address->>'line2')>300
      or length(v_address->>'state')>150 or length(v_address->>'postal_code')>32 or v_address->>'country' !~ '^[A-Z]{2}$'
      or not (v_res.offer_snapshot->'shipping'->'supportedRegions' ? (v_address->>'country')) then
      raise exception 'Shipping address does not match purchased shipping regions' using errcode='23514'; end if;
    insert into public.cqa_order_shipments(order_id,business_id,shipping_address)
      values(p_order_id,v_order.business_id,v_address) on conflict(order_id) do nothing;
    select * into v_shipment from public.cqa_order_shipments where order_id=p_order_id for update;
    if v_shipment.business_id<>v_order.business_id or v_shipment.shipping_address<>v_address then
      raise exception 'Checkout retry changed its shipping contract' using errcode='23514'; end if;
  end if;
  insert into public.cqa_product_fulfillment_jobs(order_id,business_id,kind,state)
    values(p_order_id,v_order.business_id,v_kind,case when v_kind='digital_access' then 'completed' else 'queued' end)
    on conflict(order_id) do nothing;
  select * into v_job from public.cqa_product_fulfillment_jobs where order_id=p_order_id for update;
  if v_job.business_id<>v_order.business_id or v_job.kind<>v_kind or v_job.state='cancelled' then
    raise exception 'Paid product fulfilment contract mismatch' using errcode='23514'; end if;
  return jsonb_build_object('job',to_jsonb(v_job),'shipment',case when v_shipment.order_id is null then null else to_jsonb(v_shipment) end,
    'reservation',case when v_res.id is null then null else to_jsonb(v_res) end);
end $$;

create function public.cqa_update_order_shipment(p_order_id uuid,p_actor_user_id uuid,p_action text,p_payload jsonb,p_expected_revision integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_order public.cqa_orders%rowtype; v_ship public.cqa_order_shipments%rowtype;
  v_job public.cqa_product_fulfillment_jobs%rowtype; v_owner uuid; v_carrier text; v_tracking text; v_url text;
begin
  if p_payload is null or jsonb_typeof(p_payload)<>'object' or length(p_payload::text)>5000
    or p_expected_revision is null or p_expected_revision<0 then raise exception 'Invalid shipment request' using errcode='23514'; end if;
  select * into v_order from public.cqa_orders where id=p_order_id for update;
  if not found then raise exception 'Order unavailable' using errcode='P0002'; end if;
  select owner_id into v_owner from public.cqa_businesses where id=v_order.business_id;
  if p_actor_user_id is null or v_owner is distinct from p_actor_user_id then raise exception 'Order unavailable' using errcode='42501'; end if;
  if v_order.status<>'paid' then raise exception 'Only paid orders can ship' using errcode='23514'; end if;
  select * into v_ship from public.cqa_order_shipments where order_id=p_order_id and business_id=v_order.business_id for update;
  if not found then raise exception 'Shipment unavailable' using errcode='P0002'; end if;
  if v_ship.revision<>p_expected_revision then raise exception 'Shipment changed; refresh before retry' using errcode='40001'; end if;
  if p_action='pack' and v_ship.state='ready' then v_ship.state:='packing';
  elsif p_action='ship' and v_ship.state in ('ready','packing') then
    v_carrier:=btrim(coalesce(p_payload->>'carrier','')); v_tracking:=btrim(coalesce(p_payload->>'tracking_number',''));
    v_url:=nullif(btrim(coalesce(p_payload->>'tracking_url','')),'');
    if length(v_carrier) not between 1 and 100 or length(v_tracking) not between 1 and 200
      or v_carrier ~ '[[:cntrl:]]' or v_tracking ~ '[[:cntrl:]]'
      or (v_url is not null and (length(v_url)>2000 or v_url !~ '^https://[A-Za-z0-9][A-Za-z0-9.-]*([/?#]|$)' or v_url ~ '[[:space:]]')) then
      raise exception 'Valid carrier and tracking details required' using errcode='23514'; end if;
    v_ship.state:='shipped'; v_ship.carrier:=v_carrier; v_ship.tracking_number:=v_tracking; v_ship.tracking_url:=v_url; v_ship.shipped_at:=now();
  elsif p_action='deliver' and v_ship.state='shipped' then v_ship.state:='delivered'; v_ship.delivered_at:=now();
  else raise exception 'Invalid shipment transition' using errcode='23514'; end if;
  update public.cqa_order_shipments set state=v_ship.state,carrier=v_ship.carrier,tracking_number=v_ship.tracking_number,
    tracking_url=v_ship.tracking_url,shipped_at=v_ship.shipped_at,delivered_at=v_ship.delivered_at,
    revision=revision+1,updated_at=now() where order_id=p_order_id returning * into v_ship;
  update public.cqa_product_fulfillment_jobs set state=case when v_ship.state='delivered' then 'completed' else 'processing' end,
    updated_at=now() where order_id=p_order_id and business_id=v_order.business_id and kind='physical_shipment' and state<>'cancelled'
    returning * into v_job;
  if not found then raise exception 'Shipment fulfilment job unavailable' using errcode='23514'; end if;
  return jsonb_build_object('shipment',to_jsonb(v_ship),'job',to_jsonb(v_job));
end $$;

create function public.cqa_revoke_product_fulfillment() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.status in ('refunded','cancelled','disputed') and new.status is distinct from old.status then
    perform public.cqa_settle_inventory_reservation(new.stripe_checkout_session_id,'release');
    update public.cqa_product_fulfillment_jobs set state='cancelled',updated_at=now()
      where order_id=new.id and state in ('queued','processing');
    update public.cqa_order_shipments set state='cancelled',revision=revision+1,updated_at=now()
      where order_id=new.id and state in ('ready','packing');
  end if;
  return new;
end $$;
revoke all on function public.cqa_revoke_product_fulfillment() from public,anon,authenticated;
create trigger cqa_product_order_revocation after update of status on public.cqa_orders
  for each row execute function public.cqa_revoke_product_fulfillment();

create function public.cqa_owner_product_inventory(p_business_id uuid,p_actor_user_id uuid,p_offer_ids uuid[])
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_inventory jsonb;
begin
  if p_actor_user_id is null or not exists(select 1 from public.cqa_businesses where id=p_business_id and owner_id=p_actor_user_id) then
    raise exception 'Business unavailable' using errcode='42501'; end if;
  if p_offer_ids is null or cardinality(p_offer_ids)>100 then raise exception 'Invalid product page' using errcode='23514'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('offer_id',o.id,'reserved_quantity',coalesce(r.quantity,0),
    'available_quantity',case when o.inventory_tracking then o.inventory_quantity-coalesce(r.quantity,0) else null end)),'[]'::jsonb)
    into v_inventory from public.cqa_offers o left join
      (select offer_id,sum(quantity)::integer quantity from public.cqa_inventory_reservations where state='reserved' and inventory_tracked group by offer_id) r on r.offer_id=o.id
    where o.business_id=p_business_id and o.id=any(p_offer_ids);
  return jsonb_build_object('inventory',v_inventory);
end $$;

-- Verified server actor + optimistic revision + stock delta in one transaction.
create function public.cqa_owner_save_product(p_business_id uuid,p_machine_id uuid,p_actor_user_id uuid,p_offer_id uuid,
  p_expected_revision integer,p_inventory_delta integer,p_product jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_offer public.cqa_offers%rowtype; v_new boolean:=p_offer_id is null; v_id uuid:=coalesce(p_offer_id,gen_random_uuid());
  v_config jsonb; v_input jsonb; v_shipping jsonb; v_key text; v_text text; v_stock integer;
  v_reserved bigint; v_tracking boolean; v_active boolean; v_type text; v_fulfillment text; v_price integer;
begin
  if p_actor_user_id is null or not exists(select 1 from public.cqa_businesses where id=p_business_id and owner_id=p_actor_user_id)
    or not exists(select 1 from public.cqa_machines where id=p_machine_id and business_id=p_business_id) then
    raise exception 'Business machine unavailable' using errcode='42501'; end if;
  if p_product is null or jsonb_typeof(p_product)<>'object' or length(p_product::text)>48000 or p_inventory_delta is null
    or p_inventory_delta not between -1000000 and 1000000 then raise exception 'Invalid product' using errcode='23514'; end if;
  v_type:=p_product->>'offer_type'; v_fulfillment:=p_product->>'fulfillment_type';
  if v_type not in ('physical_product','digital_product') or v_type is null
    or v_fulfillment is distinct from (case when v_type='physical_product' then 'shipping' else 'digital' end)
    or length(btrim(coalesce(p_product->>'name',''))) not between 1 and 200 or length(coalesce(p_product->>'description',''))>5000
    or p_product->>'currency' is distinct from 'aud' or coalesce(p_product->>'price_cents','') !~ '^[0-9]{1,9}$'
    or jsonb_typeof(p_product->'active') is distinct from 'boolean' or jsonb_typeof(p_product->'inventory_tracking') is distinct from 'boolean'
    or jsonb_typeof(p_product->'shipping_required') is distinct from 'boolean'
    or (p_product->>'shipping_required')::boolean is distinct from (v_type='physical_product') then
    raise exception 'Invalid product fields' using errcode='23514'; end if;
  v_price:=(p_product->>'price_cents')::integer;
  if v_price not between 50 and 99999999 then raise exception 'Invalid product price' using errcode='23514'; end if;
  v_tracking:=(p_product->>'inventory_tracking')::boolean; v_active:=(p_product->>'active')::boolean;
  if not v_new then
    select * into v_offer from public.cqa_offers where id=v_id and business_id=p_business_id and machine_id=p_machine_id for update;
    if not found then raise exception 'Product unavailable' using errcode='P0002'; end if;
    if p_expected_revision is null or p_expected_revision<>v_offer.product_revision then raise exception 'Product changed; refresh before retry' using errcode='40001'; end if;
    if v_offer.offer_type<>v_type or v_offer.fulfillment_type<>v_fulfillment then raise exception 'Product kind cannot change; archive and create a new product' using errcode='23514'; end if;
    v_config:=coalesce(v_offer.fulfillment_config,'{}'::jsonb); v_stock:=coalesce(v_offer.inventory_quantity,0)+p_inventory_delta;
  else
    if p_expected_revision is not null or p_inventory_delta<0 then raise exception 'Invalid new product inventory' using errcode='23514'; end if;
    v_config:='{}'::jsonb; v_stock:=p_inventory_delta;
  end if;
  if v_stock<0 then raise exception 'Inventory cannot be negative' using errcode='23514'; end if;
  if p_product ? 'fulfillment_config' then
    v_input:=p_product->'fulfillment_config';
    if jsonb_typeof(v_input) is distinct from 'object' then raise exception 'Invalid delivery terms' using errcode='23514'; end if;
    for v_key in select jsonb_object_keys(v_input) loop
      if v_key not in ('deliveryDescription','deliveryTiming','supportDetails','refundTerms','shipping','provider') then
        raise exception 'Only presentation and merchant shipping settings can be edited' using errcode='23514'; end if;
      if v_key in ('deliveryDescription','deliveryTiming','supportDetails','refundTerms') then
        if jsonb_typeof(v_input->v_key) is distinct from 'string' or length(v_input->>v_key)>5000 then raise exception 'Invalid delivery terms' using errcode='23514'; end if;
      elsif v_key='provider' and v_input->>'provider' is distinct from 'merchant' then raise exception 'Unsupported fulfilment provider' using errcode='23514'; end if;
    end loop;
    if v_input ? 'shipping' then
      v_shipping:=v_input->'shipping';
      if jsonb_typeof(v_shipping) is distinct from 'object' then raise exception 'Invalid shipping settings' using errcode='23514'; end if;
      for v_key in select jsonb_object_keys(v_shipping) loop
        if v_key not in ('supportedRegions','flatFeeCents','dispatchTiming') then raise exception 'Invalid shipping settings' using errcode='23514'; end if;
      end loop;
      if jsonb_typeof(v_shipping->'supportedRegions') is distinct from 'array' or jsonb_array_length(v_shipping->'supportedRegions') not between 1 and 30
        or exists(select 1 from jsonb_array_elements(v_shipping->'supportedRegions') e where jsonb_typeof(e)<>'string' or e#>>'{}' !~ '^[A-Z]{2}$')
        or coalesce(v_shipping->>'flatFeeCents','') !~ '^[0-9]{1,7}$' or (v_shipping->>'flatFeeCents')::integer>1000000
        or jsonb_typeof(v_shipping->'dispatchTiming') is distinct from 'string' or length(v_shipping->>'dispatchTiming')>1000 then
        raise exception 'Invalid shipping settings' using errcode='23514'; end if;
    end if;
    v_config:=v_config||v_input;
  end if;
  if v_type='physical_product' and (v_config->>'provider' is distinct from 'merchant' or jsonb_typeof(v_config->'shipping') is distinct from 'object') then
    raise exception 'Configure merchant shipping before saving a physical product' using errcode='23514'; end if;
  if v_type='digital_product' and v_active and (
    coalesce(v_config->>'asset_key','') not like 'marketplace/'||p_business_id::text||'/'||v_id::text||'/%'
    or coalesce(v_config->>'asset_key','') like '%..%' or coalesce(v_config->>'asset_key','') ~ '[\\?#]'
    or coalesce(v_config->>'asset_size_bytes','') !~ '^[0-9]{1,7}$'
    or (v_config->>'asset_size_bytes')::integer not between 1 and 4194304
    or coalesce(v_config->>'asset_content_type','') not in ('application/pdf','application/zip','image/png','image/jpeg','text/plain')) then
    raise exception 'Attach a verified private product file before activating this download' using errcode='23514'; end if;
  for v_key in select unnest(array['image_url','external_url']) loop
    v_text:=nullif(btrim(coalesce(p_product->>v_key,'')),'');
    if v_text is not null and (length(v_text)>2048 or v_text !~ '^https://[A-Za-z0-9][A-Za-z0-9.-]*([/?#]|$)' or v_text ~ '[[:space:]]') then
      raise exception 'Product links must be HTTPS URLs without credentials' using errcode='23514'; end if;
  end loop;
  if v_new then
    insert into public.cqa_offers(id,business_id,machine_id,name,description,offer_type,fulfillment_type,shipping_required,inventory_tracking,inventory_quantity,
      price_cents,currency,active,image_url,external_url,fulfillment_config,product_revision)
      values(v_id,p_business_id,p_machine_id,btrim(p_product->>'name'),nullif(p_product->>'description',''),v_type,v_fulfillment,v_type='physical_product',v_tracking,
        case when v_tracking then v_stock else null end,v_price,'aud',v_active,nullif(btrim(p_product->>'image_url'),''),nullif(btrim(p_product->>'external_url'),''),v_config,1)
      returning * into v_offer;
  else
    update public.cqa_offers set name=btrim(p_product->>'name'),description=nullif(p_product->>'description',''),shipping_required=v_type='physical_product',
      inventory_tracking=v_tracking,inventory_quantity=case when v_tracking then v_stock else null end,price_cents=v_price,currency='aud',active=v_active,
      image_url=nullif(btrim(p_product->>'image_url'),''),external_url=nullif(btrim(p_product->>'external_url'),''),fulfillment_config=v_config,updated_at=now()
      where id=v_id returning * into v_offer;
  end if;
  select coalesce(sum(quantity),0) into v_reserved from public.cqa_inventory_reservations where offer_id=v_id and state='reserved' and inventory_tracked;
  return jsonb_build_object('product',to_jsonb(v_offer),'reserved_quantity',v_reserved,
    'available_quantity',case when v_offer.inventory_tracking then v_offer.inventory_quantity-v_reserved else null end);
end $$;

revoke all on function public.cqa_reserve_inventory(uuid,uuid,uuid,integer),
  public.cqa_bind_inventory_reservation(uuid,text,uuid),public.cqa_release_inventory_reservation(uuid),
  public.cqa_settle_inventory_reservation(text,text),public.cqa_record_product_fulfillment(uuid,text,jsonb),
  public.cqa_update_order_shipment(uuid,uuid,text,jsonb,integer),public.cqa_owner_product_inventory(uuid,uuid,uuid[]),
  public.cqa_owner_save_product(uuid,uuid,uuid,uuid,integer,integer,jsonb) from public,anon,authenticated;
grant execute on function public.cqa_reserve_inventory(uuid,uuid,uuid,integer),
  public.cqa_bind_inventory_reservation(uuid,text,uuid),public.cqa_release_inventory_reservation(uuid),
  public.cqa_settle_inventory_reservation(text,text),public.cqa_record_product_fulfillment(uuid,text,jsonb),
  public.cqa_update_order_shipment(uuid,uuid,text,jsonb,integer),public.cqa_owner_product_inventory(uuid,uuid,uuid[]),
  public.cqa_owner_save_product(uuid,uuid,uuid,uuid,integer,integer,jsonb) to service_role;

comment on column public.cqa_offers.inventory_quantity is 'Stock on hand; available to sell subtracts all tracked reserved holds, including clock-expired holds until verified provider release.';
comment on table public.cqa_product_fulfillment_jobs is 'Durable paid product fulfilment ledger. digital_access completed means entitlement available, not email sent or bytes downloaded.';
commit;
