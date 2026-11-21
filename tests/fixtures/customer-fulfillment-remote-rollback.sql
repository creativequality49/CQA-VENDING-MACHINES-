-- ISOLATED PROJECT ONLY: CQA Launch Test (ndzmlywsuywkhgqdbzft).
-- Execute only after its customer_fulfillment migration and explicit test approval.
-- This proves database behaviour, NOT real Auth signup or payment/provider delivery.
-- Every synthetic user, business, offer, order and event is transaction-scoped.
-- Expected errors are handled below; any unexpected error aborts the transaction.
-- No auth passwords, tokens, email sends, storage objects or external calls exist.
begin;

do $test$
declare
  v_owner uuid := gen_random_uuid();
  v_buyer uuid := gen_random_uuid();
  v_outsider uuid := gen_random_uuid();
  v_other_owner uuid := gen_random_uuid();
  v_business uuid := gen_random_uuid();
  v_other_business uuid := gen_random_uuid();
  v_machine uuid := gen_random_uuid();
  v_other_machine uuid := gen_random_uuid();
  v_offer uuid := gen_random_uuid();
  v_other_offer uuid := gen_random_uuid();
  v_order uuid := gen_random_uuid();
  v_other_order uuid := gen_random_uuid();
  v_pending_order uuid := gen_random_uuid();
  v_result jsonb;
  v_count integer;
  v_brief jsonb := '{"businessName":"Rollback-only fixture","goals":"Verify paid fulfilment transitions","details":"Synthetic database test. Not a customer."}'::jsonb;
begin
  if exists(select 1 from auth.users where email like 'cqa-fulfillment-rollback-verifier-%@example.invalid') then
    raise exception 'Reserved rollback-fixture prefix already exists; investigate instead of touching existing records';
  end if;
  if has_function_privilege('anon','public.cqa_update_order_workspace(uuid,uuid,text,jsonb,integer)','EXECUTE')
    or has_function_privilege('authenticated','public.cqa_update_order_workspace(uuid,uuid,text,jsonb,integer)','EXECUTE')
    or not has_function_privilege('service_role','public.cqa_update_order_workspace(uuid,uuid,text,jsonb,integer)','EXECUTE') then
    raise exception 'Unexpected fulfilment function privileges';
  end if;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='cqa_update_order_workspace' and p.prosecdef) then
    raise exception 'Fulfilment function must remain SECURITY INVOKER';
  end if;

  insert into auth.users (id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  select user_id,'cqa-fulfillment-rollback-verifier-'||user_id::text||'@example.invalid',now(),
    '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()
    from unnest(array[v_owner,v_buyer,v_outsider,v_other_owner]) as fixture(user_id);
  insert into public.cqa_businesses (id,owner_id,name,slug)
    values (v_business,v_owner,'CQA rollback-only verification','cqa-rollback-'||v_business::text),
      (v_other_business,v_other_owner,'CQA rollback-only foreign verification','cqa-rollback-'||v_other_business::text);
  insert into public.cqa_machines (id,business_id,slug,title)
    values (v_machine,v_business,'cqa-rollback-'||v_machine::text,'Rollback-only machine'),
      (v_other_machine,v_other_business,'cqa-rollback-'||v_other_machine::text,'Foreign rollback-only machine');
  insert into public.cqa_offers (id,business_id,machine_id,name,offer_type,fulfillment_type,price_cents)
    values (v_offer,v_business,v_machine,'Rollback-only service','service','service',4900),
      (v_other_offer,v_other_business,v_other_machine,'Foreign rollback-only service','service','service',4900);
  insert into public.cqa_orders (id,business_id,machine_id,offer_id,customer_user_id,buyer_user_id,status,amount_cents,purchase_snapshot)
    values (v_order,v_business,v_machine,v_offer,v_buyer,v_buyer,'paid',4900,
        '{"title":"Rollback-only service","offerType":"service","fulfillmentType":"service"}'::jsonb),
      (v_other_order,v_other_business,v_other_machine,v_other_offer,v_buyer,v_buyer,'paid',4900,
        '{"title":"Foreign rollback-only service","offerType":"service","fulfillmentType":"service"}'::jsonb),
      (v_pending_order,v_business,v_machine,v_offer,v_buyer,v_buyer,'pending',4900,
        '{"title":"Pending rollback-only service","offerType":"service","fulfillmentType":"service"}'::jsonb);

  set local role service_role;
  begin
    perform public.cqa_update_order_workspace(v_order,v_outsider,'submit_intake',v_brief,0);
    raise exception 'Foreign buyer unexpectedly accessed order';
  exception when insufficient_privilege then null; end;
  begin
    perform public.cqa_update_order_workspace(v_order,v_other_owner,'start','{}'::jsonb,0);
    raise exception 'Foreign owner unexpectedly accessed order';
  exception when insufficient_privilege then null; end;
  begin
    perform public.cqa_update_order_workspace(v_pending_order,v_buyer,'submit_intake',v_brief,0);
    raise exception 'Unpaid order unexpectedly received fulfilment';
  exception when check_violation then null; end;

  select public.cqa_update_order_workspace(v_order,v_buyer,'submit_intake',v_brief,0) into v_result;
  if v_result->'workspace'->>'state' <> 'queued' or (v_result->'workspace'->>'revision')::integer <> 1 then
    raise exception 'Intake transition did not persist'; end if;
  begin
    perform public.cqa_update_order_workspace(v_order,v_owner,'start','{}'::jsonb,0);
    raise exception 'Stale revision unexpectedly succeeded';
  exception when serialization_failure then null; end;
  select public.cqa_update_order_workspace(v_order,v_owner,'start','{}'::jsonb,1) into v_result;
  if v_result->'workspace'->>'state' <> 'in_progress' or (v_result->'workspace'->>'revision')::integer <> 2 then
    raise exception 'Start-work transition did not persist'; end if;
  select public.cqa_update_order_workspace(v_order,v_owner,'attach_asset',jsonb_build_object(
    'asset_key','fulfillment/'||v_business::text||'/'||v_order::text||'/'||gen_random_uuid()::text||'.txt',
    'asset_name','rollback-only-fixture.txt','asset_type','text/plain','asset_size',20),2) into v_result;
  if (v_result->'workspace'->>'revision')::integer <> 3 then raise exception 'Asset attachment did not persist'; end if;
  select public.cqa_update_order_workspace(v_order,v_owner,'deliver',
    '{"message":"Synthetic rollback-only delivery. No file exists."}'::jsonb,3) into v_result;
  if v_result->'workspace'->>'state' <> 'delivered' or (v_result->'workspace'->>'revision')::integer <> 4 then
    raise exception 'Delivery transition did not persist'; end if;
  select count(*) into v_count from public.cqa_order_events where order_id=v_order;
  if v_count <> 4 then raise exception 'Expected four atomic fulfilment events'; end if;
  perform public.cqa_update_order_workspace(v_other_order,v_buyer,'submit_intake',v_brief,0);

  reset role;
  perform set_config('request.jwt.claim.sub',v_owner::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_owner::text,'role','authenticated')::text,true);
  set local role authenticated;
  select count(*) into v_count from public.cqa_order_workspaces where order_id in (v_order,v_other_order);
  if v_count <> 1 then raise exception 'Owner RLS did not isolate business workspaces'; end if;
  select count(*) into v_count from public.cqa_order_events where order_id in (v_order,v_other_order);
  if v_count <> 4 then raise exception 'Owner RLS did not isolate order events'; end if;
  begin
    perform public.cqa_update_order_workspace(v_order,v_owner,'deliver','{}'::jsonb,4);
    raise exception 'Browser role unexpectedly invoked privileged fulfilment';
  exception when insufficient_privilege then null; end;
  begin
    update public.cqa_order_workspaces set state='queued' where order_id=v_order;
    raise exception 'Browser role unexpectedly wrote fulfilment state';
  exception when insufficient_privilege then null; end;

  reset role;
  perform set_config('request.jwt.claim.sub',v_buyer::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_buyer::text,'role','authenticated')::text,true);
  set local role authenticated;
  select count(*) into v_count from public.cqa_order_workspaces where order_id in (v_order,v_other_order);
  if v_count <> 0 then raise exception 'Buyer unexpectedly read internal fulfilment rows directly'; end if;

  reset role;
  set local role anon;
  begin
    perform 1 from public.cqa_order_workspaces where order_id=v_order;
    raise exception 'Anonymous role unexpectedly read fulfilment rows';
  exception when insufficient_privilege then null; end;
  begin
    perform public.cqa_update_order_workspace(v_order,v_buyer,'submit_intake',v_brief,4);
    raise exception 'Anonymous role unexpectedly invoked privileged fulfilment';
  exception when insufficient_privilege then null; end;

  reset role;
  set local role service_role;
  update public.cqa_orders set status='refunded',buyer_user_id=null where id=v_order;
  begin
    perform public.cqa_update_order_workspace(v_order,v_owner,'deliver','{"message":"Must be rejected"}'::jsonb,4);
    raise exception 'Refunded order unexpectedly received new fulfilment';
  exception when check_violation then null; end;
  if not exists(select 1 from public.cqa_orders where id=v_order and customer_user_id=v_buyer and buyer_user_id is null) then
    raise exception 'Refund changed historical purchaser identity'; end if;
  reset role;
end;
$test$;

rollback;

-- This result is emitted only if every assertion passed and rollback completed.
select jsonb_build_object(
  'passed',true,
  'scope','isolated PostgreSQL fulfilment transitions and role permissions only',
  'persistent_fixture_users',(select count(*) from auth.users where email like 'cqa-fulfillment-rollback-verifier-%@example.invalid'),
  'persistent_fixture_businesses',(select count(*) from public.cqa_businesses where slug like 'cqa-rollback-%'),
  'transaction_rolled_back',true,
  'proves_real_signup',false,'proves_payment',false,'proves_storage_delivery',false
) as isolated_verification;
