-- Add supplier fulfilment to the existing single-line purchase and inventory ledger.
begin;

alter table public.cqa_offers
  add column fulfilment_type text,
  add column supplier_provider text,
  add column supplier_variant_sku text;
alter table public.cqa_orders add column supplier_refund_observed boolean not null default false;
alter table public.cqa_offers add constraint cqa_offers_pilot_fulfilment_contract check (
  (fulfilment_type is null and supplier_provider is null and supplier_variant_sku is null)
  or coalesce((
    case fulfilment_type
      when 'digital_download' then offer_type='digital_product' and fulfillment_type='digital'
        and supplier_provider is null and supplier_variant_sku is null
      when 'seller_shipped' then offer_type='physical_product' and fulfillment_type='shipping'
        and inventory_tracking and inventory_quantity>=0 and supplier_provider is null and supplier_variant_sku is null
      when 'supplier_shipped' then offer_type='physical_product' and fulfillment_type='shipping'
        and not inventory_tracking and inventory_quantity is null and supplier_provider in ('mock','cjdropshipping')
        and supplier_variant_sku ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'
      when 'affiliate_link' then supplier_provider is null and supplier_variant_sku is null
        and external_url ~ '^https://[A-Za-z0-9][A-Za-z0-9.-]*([/?#]|$)' and external_url !~ '[[:space:]]'
      else false end),false)
);

create function public.cqa_guard_pilot_fulfilment_fields() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if current_user in ('service_role','postgres','supabase_admin') then return new; end if;
  if (TG_OP='INSERT' and new.fulfilment_type is not null) or
     (TG_OP='UPDATE' and (new.fulfilment_type is distinct from old.fulfilment_type
      or new.supplier_provider is distinct from old.supplier_provider
      or new.supplier_variant_sku is distinct from old.supplier_variant_sku
      or (new.fulfilment_type='affiliate_link' and new.external_url is distinct from old.external_url))) then
    raise exception 'Fulfilment settings require the merchant server endpoint' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function public.cqa_guard_pilot_fulfilment_fields() from public,anon,authenticated;
create trigger cqa_pilot_fulfilment_fields_guard before insert or update on public.cqa_offers
  for each row execute function public.cqa_guard_pilot_fulfilment_fields();

-- A CQA order is the single purchased line in this pilot.
create table public.cqa_supplier_fulfilments (
  order_item_id uuid primary key references public.cqa_orders(id),
  business_id uuid not null references public.cqa_businesses(id),
  provider text not null check (provider in ('mock','cjdropshipping')),
  variant_sku text not null check (variant_sku ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'),
  state text not null default 'awaiting_approval' check (state in ('awaiting_approval','submitting','submitted','reconciliation_required','blocked','returns_review')),
  approval_quote jsonb check (approval_quote is null or jsonb_typeof(approval_quote)='object'),
  supplier_order_id text,
  supplier_payment_state text not null default 'unpaid' check (supplier_payment_state in ('unpaid','paid')),
  revision integer not null default 0 check (revision>=0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider,supplier_order_id)
);
create index cqa_supplier_fulfilments_business_idx on public.cqa_supplier_fulfilments(business_id,state);
alter table public.cqa_supplier_fulfilments enable row level security;
revoke all on public.cqa_supplier_fulfilments from public,anon,authenticated;
grant all on public.cqa_supplier_fulfilments to service_role;

-- Keep existing seller shipment metadata visibility. Addresses are served through
-- authenticated order endpoints only.
revoke select on public.cqa_order_shipments from authenticated;
grant select (order_id,business_id,state,carrier,tracking_number,tracking_url,revision,shipped_at,delivered_at,created_at,updated_at)
  on public.cqa_order_shipments to authenticated;

create function public.cqa_revoke_supplier_fulfilment() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if (new.status in ('refunded','cancelled','disputed') and new.status is distinct from old.status) or
     (new.supplier_refund_observed and not old.supplier_refund_observed) then
    update public.cqa_supplier_fulfilments
      set state=case when state='awaiting_approval' then 'blocked' else 'returns_review' end,
          revision=revision+1,updated_at=now()
      where order_item_id=new.id and state in ('awaiting_approval','submitting','submitted','reconciliation_required');
  end if;
  return new;
end $$;
revoke all on function public.cqa_revoke_supplier_fulfilment() from public,anon,authenticated;
create trigger cqa_supplier_order_revocation after update of status,supplier_refund_observed on public.cqa_orders
  for each row execute function public.cqa_revoke_supplier_fulfilment();


create or replace function public.cqa_reserve_inventory(p_offer_id uuid,p_buyer_user_id uuid,p_idempotency_key uuid,p_quantity integer default 1)
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
  if v_offer.fulfilment_type='affiliate_link' then
    raise exception 'External offers cannot reserve inventory' using errcode='23514'; end if;
  if v_offer.offer_type='physical_product' and v_offer.fulfilment_type is distinct from 'supplier_shipped' and not v_offer.inventory_tracking then
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
        'productRevision',v_offer.product_revision,'pilotFulfilmentType',v_offer.fulfilment_type,
        'sku',case when v_offer.fulfilment_type='supplier_shipped' then v_offer.supplier_variant_sku else v_offer.id::text end,
        'supplierProvider',v_offer.supplier_provider,'shippingRequired',v_offer.shipping_required,'inventoryTracked',v_offer.inventory_tracking,
        'priceCents',v_offer.price_cents,'currency',v_offer.currency,'shipping',v_shipping,'terms',v_terms,
        'fulfillmentConfig',v_terms||jsonb_build_object('provider','merchant','shipping',v_shipping))) returning * into v_res;
  return jsonb_build_object('reservation',to_jsonb(v_res));
end $$;

create or replace function public.cqa_bind_inventory_reservation(p_reservation_id uuid,p_checkout_session_id text,p_order_id uuid)
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
    or v_order.purchase_snapshot->>'fulfillmentType' is distinct from v_res.offer_snapshot->>'fulfillmentType'
    or (v_res.offer_snapshot->>'offerType'='physical_product' and v_res.offer_snapshot->>'pilotFulfilmentType' is not null and (
      v_order.purchase_snapshot->>'fulfilmentType' is distinct from v_res.offer_snapshot->>'pilotFulfilmentType'
      or v_order.purchase_snapshot->>'sku' is distinct from v_res.offer_snapshot->>'sku'
      or (v_res.offer_snapshot->>'pilotFulfilmentType'='supplier_shipped'
        and v_order.purchase_snapshot->'shipping'->>'provider' is distinct from v_res.offer_snapshot->>'supplierProvider')
    )) then
    raise exception 'Reservation does not match its durable order contract' using errcode='23514'; end if;
  update public.cqa_inventory_reservations set stripe_checkout_session_id=p_checkout_session_id,order_id=p_order_id,updated_at=now()
    where id=p_reservation_id returning * into v_res;
  return jsonb_build_object('reservation',to_jsonb(v_res));
end $$;

create or replace function public.cqa_record_product_fulfillment(p_order_id uuid,p_checkout_session_id text,p_shipping_address jsonb default '{}'::jsonb)
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
    if v_snapshot->>'fulfilmentType'='supplier_shipped' then
      if length(btrim(coalesce(p_shipping_address->>'phone',''))) not between 5 and 40 then
        raise exception 'Verified supplier delivery contact required' using errcode='23514'; end if;
      v_address:=v_address||jsonb_build_object('phone',btrim(p_shipping_address->>'phone'));
      insert into public.cqa_supplier_fulfilments(order_item_id,business_id,provider,variant_sku,state)
        values(p_order_id,v_order.business_id,v_snapshot->'shipping'->>'provider',v_snapshot->>'sku',
          case when v_order.supplier_refund_observed then 'blocked' else 'awaiting_approval' end)
        on conflict(order_item_id) do nothing;
    end if;
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

create or replace function public.cqa_update_order_shipment(p_order_id uuid,p_actor_user_id uuid,p_action text,p_payload jsonb,p_expected_revision integer)
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
  if v_order.purchase_snapshot->>'fulfilmentType'='supplier_shipped' then
    raise exception 'Supplier orders use supplier tracking' using errcode='23514'; end if;
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

commit;
