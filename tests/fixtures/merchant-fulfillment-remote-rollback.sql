-- ISOLATED CQA Launch Test ONLY (ndzmlywsuywkhgqdbzft).
-- Actual PostgreSQL/RLS test; not a Stripe payment, signup email or carrier test.
-- All synthetic data and trigger side effects are rolled back.
begin;
do $test$
declare
  v_owner uuid:=gen_random_uuid();v_buyer uuid:=gen_random_uuid();v_outsider uuid:=gen_random_uuid();
  v_business uuid:=gen_random_uuid();v_machine uuid:=gen_random_uuid();v_offer uuid;
  v_order uuid:=gen_random_uuid();v_expired uuid:=gen_random_uuid();v_first uuid;v_second uuid;v_result jsonb;v_count integer;
  v_session text:='cs_rollback_'||replace(gen_random_uuid()::text,'-','');
  v_expiry_session text:='cs_rollback_'||replace(gen_random_uuid()::text,'-','');
  v_address jsonb:='{"name":"Rollback Fixture","line1":"1 Synthetic Street","line2":"","city":"Adelaide","state":"SA","postal_code":"5000","country":"AU"}';
  v_product jsonb:='{"name":"Rollback-only Hair Care","description":"Not for sale. Transaction-scoped SQL fixture.","offer_type":"physical_product","fulfillment_type":"shipping","shipping_required":true,"inventory_tracking":true,"price_cents":2900,"currency":"aud","active":true,"image_url":null,"fulfillment_config":{"provider":"merchant","deliveryDescription":"A physical fixture","deliveryTiming":"Three days","supportDetails":"fixture@example.invalid","refundTerms":"Fixture-only returns terms","shipping":{"supportedRegions":["AU"],"flatFeeCents":750,"dispatchTiming":"Two days"}}}';
begin
  if has_function_privilege('anon','public.cqa_reserve_inventory(uuid,uuid,uuid,integer)','execute')
    or has_function_privilege('authenticated','public.cqa_owner_save_product(uuid,uuid,uuid,uuid,integer,integer,jsonb)','execute') then
    raise exception 'Privileged product RPC exposed to browser'; end if;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
    and p.proname in ('cqa_reserve_inventory','cqa_owner_save_product','cqa_record_product_fulfillment','cqa_update_order_shipment') and p.prosecdef) then
    raise exception 'Product RPC must use SECURITY INVOKER'; end if;
  insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
    select user_id,'cqa-merchant-rollback-'||user_id::text||'@example.invalid',now(),'{"provider":"email","providers":["email"]}', '{}',now(),now()
      from unnest(array[v_owner,v_buyer,v_outsider]) fixture(user_id);
  insert into public.cqa_businesses(id,owner_id,name,slug) values(v_business,v_owner,'CQA merchant rollback fixture','cqa-merchant-rollback-'||v_business::text);
  insert into public.cqa_machines(id,business_id,title,slug) values(v_machine,v_business,'Rollback-only machine','cqa-merchant-rollback-'||v_machine::text);
  set local role service_role;
  v_result:=public.cqa_owner_save_product(v_business,v_machine,v_owner,null,null,2,v_product);
  v_offer:=(v_result->'product'->>'id')::uuid;
  v_result:=public.cqa_reserve_inventory(v_offer,v_buyer,gen_random_uuid(),1);v_first:=(v_result->'reservation'->>'id')::uuid;
  v_result:=public.cqa_reserve_inventory(v_offer,v_buyer,gen_random_uuid(),1);v_second:=(v_result->'reservation'->>'id')::uuid;
  begin
    perform public.cqa_reserve_inventory(v_offer,v_buyer,gen_random_uuid(),1);raise exception 'Oversold reserved inventory';
  exception when check_violation then null;end;
  begin
    perform public.cqa_owner_save_product(v_business,v_machine,v_owner,v_offer,1,-1,v_product);raise exception 'Removed reserved stock';
  exception when check_violation then null;end;
  insert into public.cqa_orders(id,business_id,machine_id,offer_id,customer_user_id,buyer_user_id,status,amount_cents,currency,stripe_checkout_session_id,purchase_snapshot)
    values(v_order,v_business,v_machine,v_offer,v_buyer,v_buyer,'pending',3650,'aud',v_session,'{"title":"Rollback fixture","offerType":"physical_product","fulfillmentType":"shipping"}'),
      (v_expired,v_business,v_machine,v_offer,v_buyer,v_buyer,'pending',3650,'aud',v_expiry_session,'{"title":"Rollback fixture","offerType":"physical_product","fulfillmentType":"shipping"}');
  perform public.cqa_bind_inventory_reservation(v_first,v_session,v_order);
  perform public.cqa_bind_inventory_reservation(v_second,v_expiry_session,v_expired);
  update public.cqa_orders set status='paid' where id=v_order;
  perform public.cqa_record_product_fulfillment(v_order,v_session,v_address);
  perform public.cqa_record_product_fulfillment(v_order,v_session,v_address);
  select inventory_quantity into v_count from public.cqa_offers where id=v_offer;
  if v_count<>1 then raise exception 'Stock not decremented exactly once';end if;
  select count(*) into v_count from public.cqa_product_fulfillment_jobs where order_id=v_order;
  if v_count<>1 then raise exception 'Duplicate fulfillment job';end if;
  update public.cqa_orders set status='cancelled' where id=v_expired;
  begin
    update public.cqa_orders set status='paid' where id=v_expired;raise exception 'Late released payment reopened';
  exception when check_violation then null;end;
  begin
    perform public.cqa_update_order_shipment(v_order,v_outsider,'pack','{}',0);raise exception 'Foreign actor changed shipment';
  exception when insufficient_privilege then null;end;
  perform public.cqa_update_order_shipment(v_order,v_owner,'pack','{}',0);
  begin
    perform public.cqa_update_order_shipment(v_order,v_owner,'ship','{"carrier":"Fixture","tracking_number":"TEST"}',0);raise exception 'Stale shipment revision accepted';
  exception when serialization_failure then null;end;
  perform public.cqa_update_order_shipment(v_order,v_owner,'ship','{"carrier":"Fixture carrier","tracking_number":"ROLLBACK-ONLY","tracking_url":"https://example.invalid/track"}',1);
  update public.cqa_orders set status='refunded' where id=v_order;
  begin
    perform public.cqa_update_order_shipment(v_order,v_owner,'deliver','{}',2);raise exception 'Refunded shipment advanced';
  exception when check_violation then null;end;
  select inventory_quantity into v_count from public.cqa_offers where id=v_offer;
  if v_count<>1 then raise exception 'Refund automatically restocked committed goods';end if;
  if not exists(select 1 from public.cqa_order_shipments where order_id=v_order and state='shipped') then raise exception 'Refund erased shipped history';end if;
  reset role;
  perform set_config('request.jwt.claim.sub',v_outsider::text,true);
  set local role authenticated;
  select count(*) into v_count from public.cqa_order_shipments where order_id=v_order;
  if v_count<>0 then raise exception 'Outsider read shipment';end if;
  begin
    perform public.cqa_reserve_inventory(v_offer,v_buyer,gen_random_uuid(),1);raise exception 'Browser called privileged RPC';
  exception when insufficient_privilege then null;end;
  reset role;
  perform set_config('request.jwt.claim.sub',v_owner::text,true);
  set local role authenticated;
  select count(*) into v_count from public.cqa_order_shipments where order_id=v_order;
  if v_count<>1 then raise exception 'Owner shipment RLS missing';end if;
  begin
    update public.cqa_offers set inventory_quantity=999 where id=v_offer;raise exception 'Browser overwrote protected inventory';
  exception when insufficient_privilege then null;end;
  reset role;
end $test$;
select 'passed — actual isolated schema, atomic stock, nonzero shipping fee, idempotency, refund controls and RLS; transaction rolled back' as verification;
rollback;
