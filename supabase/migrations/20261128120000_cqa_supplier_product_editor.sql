create function public.cqa_owner_save_pilot_product(p_business_id uuid,p_machine_id uuid,p_actor_user_id uuid,p_offer_id uuid,
  p_expected_revision integer,p_inventory_delta integer,p_product jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_offer public.cqa_offers%rowtype; v_new boolean:=p_offer_id is null; v_id uuid:=coalesce(p_offer_id,gen_random_uuid());
  v_config jsonb; v_input jsonb; v_shipping jsonb; v_key text; v_text text; v_stock integer;
  v_reserved bigint; v_tracking boolean; v_active boolean; v_type text; v_fulfillment text; v_price integer;
  v_kind text:=p_product->>'fulfilment_type';
  v_provider text:=p_product->>'supplier_provider';
  v_sku text:=p_product->>'supplier_variant_sku';
begin
  if p_actor_user_id is null or not exists(select 1 from public.cqa_businesses where id=p_business_id and owner_id=p_actor_user_id)
    or not exists(select 1 from public.cqa_machines where id=p_machine_id and business_id=p_business_id) then
    raise exception 'Business machine unavailable' using errcode='42501'; end if;
  if p_product is null or jsonb_typeof(p_product)<>'object' or length(p_product::text)>48000 or p_inventory_delta is null
    or p_inventory_delta not between -1000000 and 1000000 then raise exception 'Invalid product' using errcode='23514'; end if;
  v_type:=p_product->>'offer_type'; v_fulfillment:=p_product->>'fulfillment_type';
  if v_kind is null or v_kind not in ('digital_download','seller_shipped','supplier_shipped','affiliate_link')
    or v_type is distinct from (case v_kind when 'affiliate_link' then 'service' when 'digital_download' then 'digital_product' else 'physical_product' end)
    or v_fulfillment is distinct from (case v_kind when 'affiliate_link' then 'external' when 'digital_download' then 'digital' else 'shipping' end)
    or (v_kind='supplier_shipped' and (coalesce(v_provider,'') not in ('mock','cjdropshipping') or coalesce(v_sku,'') !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$'))
    or (v_kind='affiliate_link' and coalesce(p_product->>'external_url','')='')
    or (v_kind<>'seller_shipped' and p_inventory_delta<>0)
    or length(btrim(coalesce(p_product->>'name',''))) not between 1 and 200 or length(coalesce(p_product->>'description',''))>5000
    or p_product->>'currency' is distinct from 'aud' or coalesce(p_product->>'price_cents','') !~ '^[0-9]{1,9}$'
    or jsonb_typeof(p_product->'active') is distinct from 'boolean' or jsonb_typeof(p_product->'inventory_tracking') is distinct from 'boolean'
    or jsonb_typeof(p_product->'shipping_required') is distinct from 'boolean'
    or (p_product->>'shipping_required')::boolean is distinct from (v_type='physical_product') then
    raise exception 'Invalid product fields' using errcode='23514'; end if;
  v_price:=case when v_kind='affiliate_link' then null else (p_product->>'price_cents')::integer end;
  if v_price not between 50 and 99999999 then raise exception 'Invalid product price' using errcode='23514'; end if;
  v_tracking:=(p_product->>'inventory_tracking')::boolean; v_active:=(p_product->>'active')::boolean;
  if v_tracking is distinct from (v_kind='seller_shipped') then raise exception 'Invalid stock mode' using errcode='23514'; end if;
  if not v_new then
    select * into v_offer from public.cqa_offers where id=v_id and business_id=p_business_id and machine_id=p_machine_id for update;
    if not found then raise exception 'Product unavailable' using errcode='P0002'; end if;
    if p_expected_revision is null or p_expected_revision<>v_offer.product_revision then raise exception 'Product changed; refresh before retry' using errcode='40001'; end if;
    if v_offer.offer_type<>v_type or v_offer.fulfillment_type<>v_fulfillment or
      coalesce(v_offer.fulfilment_type,case when v_type='physical_product' then 'seller_shipped' else 'digital_download' end)<>v_kind then raise exception 'Product kind cannot change; archive and create a new product' using errcode='23514'; end if;
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
      price_cents,currency,active,image_url,external_url,fulfillment_config,product_revision,fulfilment_type,supplier_provider,supplier_variant_sku)
      values(v_id,p_business_id,p_machine_id,btrim(p_product->>'name'),nullif(p_product->>'description',''),v_type,v_fulfillment,v_type='physical_product',v_tracking,
        case when v_tracking then v_stock else null end,v_price,'aud',v_active,nullif(btrim(p_product->>'image_url'),''),nullif(btrim(p_product->>'external_url'),''),v_config,1,v_kind,v_provider,v_sku)
      returning * into v_offer;
  else
    update public.cqa_offers set name=btrim(p_product->>'name'),description=nullif(p_product->>'description',''),shipping_required=v_type='physical_product',
      inventory_tracking=v_tracking,inventory_quantity=case when v_tracking then v_stock else null end,price_cents=v_price,currency='aud',active=v_active,
      image_url=nullif(btrim(p_product->>'image_url'),''),external_url=nullif(btrim(p_product->>'external_url'),''),fulfillment_config=v_config,fulfilment_type=v_kind,supplier_provider=v_provider,supplier_variant_sku=v_sku,updated_at=now()
      where id=v_id returning * into v_offer;
  end if;
  select coalesce(sum(quantity),0) into v_reserved from public.cqa_inventory_reservations where offer_id=v_id and state='reserved' and inventory_tracked;
  return jsonb_build_object('product',to_jsonb(v_offer),'reserved_quantity',v_reserved,
    'available_quantity',case when v_offer.inventory_tracking then v_offer.inventory_quantity-v_reserved else null end);
end $$;

revoke all on function public.cqa_owner_save_pilot_product(uuid,uuid,uuid,uuid,integer,integer,jsonb) from public,anon,authenticated;
grant execute on function public.cqa_owner_save_pilot_product(uuid,uuid,uuid,uuid,integer,integer,jsonb) to service_role;
