alter table public.cqa_supplier_fulfilments
  add column approved_at timestamptz,
  add column approved_by uuid;

create function public.cqa_supplier_approval(
  p_order_id uuid, p_actor_user_id uuid, p_revision integer, p_action text, p_quote jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  v_order public.cqa_orders%rowtype;
  v_job public.cqa_supplier_fulfilments%rowtype;
  v_changed boolean;
begin
  select * into v_order from public.cqa_orders where id=p_order_id for update;
  if not found or not exists (
    select 1 from public.cqa_businesses where id=v_order.business_id and owner_id=p_actor_user_id
  ) then raise exception 'Order unavailable' using errcode='42501'; end if;
  select * into v_job from public.cqa_supplier_fulfilments
    where order_item_id=p_order_id and business_id=v_order.business_id for update;
  if not found or v_order.status<>'paid' or v_order.supplier_refund_observed or v_job.state<>'awaiting_approval'
    or v_job.revision is distinct from p_revision then
    raise exception 'Order changed' using errcode='40001';
  end if;
  if p_action not in ('quote','approve') or p_action is null or jsonb_typeof(p_quote) is distinct from 'object'
    or length(p_quote::text)>4000 or coalesce(p_quote->>'stock','') !~ '^[0-9]{1,9}$' then
    raise exception 'Invalid approval' using errcode='23514';
  end if;
  v_changed:=v_job.approval_quote is distinct from p_quote;
  if p_action='approve' and not v_changed and (p_quote->>'stock')::integer>=1 then
    update public.cqa_supplier_fulfilments set state='submitting', approved_at=now(), approved_by=p_actor_user_id,
      updated_at=now(), revision=revision+1 where order_item_id=p_order_id returning * into v_job;
  elsif v_changed then
    update public.cqa_supplier_fulfilments set approval_quote=p_quote, updated_at=now(), revision=revision+1
      where order_item_id=p_order_id returning * into v_job;
  end if;
  return jsonb_build_object('job',to_jsonb(v_job),'changed',v_changed);
end $$;

-- A response arriving during refund processing may record the reference, while
-- the order remains in returns review. Reconciliation never submits again.
create function public.cqa_supplier_submission_result(p_order_id uuid,p_reference text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_job public.cqa_supplier_fulfilments%rowtype;
begin
  perform 1 from public.cqa_orders where id=p_order_id for update;
  select * into v_job from public.cqa_supplier_fulfilments where order_item_id=p_order_id for update;
  if not found or v_job.state not in ('submitting','submitted','reconciliation_required','returns_review')
    or (p_reference is not null and (length(p_reference) not between 1 and 200 or
        (v_job.supplier_order_id is not null and v_job.supplier_order_id<>p_reference))) then
    raise exception 'Supplier submission changed' using errcode='40001';
  end if;
  if v_job.supplier_order_id is null and (p_reference is not null or v_job.state='submitting') then
    update public.cqa_supplier_fulfilments set supplier_order_id=p_reference,
      state=case when state='returns_review' then state when p_reference is null then 'reconciliation_required' else 'submitted' end,
      updated_at=now(),revision=revision+1 where order_item_id=p_order_id returning * into v_job;
  end if;
  return to_jsonb(v_job);
end $$;

create function public.cqa_supplier_tracking_update(p_order_id uuid,p_supplier_reference text,p_tracking jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare
  v_order public.cqa_orders%rowtype;
  v_job public.cqa_supplier_fulfilments%rowtype;
  v_state text:=p_tracking->>'status';
begin
  select * into v_order from public.cqa_orders where id=p_order_id for update;
  select * into v_job from public.cqa_supplier_fulfilments where order_item_id=p_order_id for update;
  if not found or v_job.supplier_order_id is distinct from p_supplier_reference or p_supplier_reference is null then
    raise exception 'Supplier shipment changed' using errcode='40001';
  end if;
  if p_tracking->>'supplierPaymentStatus'='paid' and v_job.supplier_payment_state='unpaid' then
    update public.cqa_supplier_fulfilments set supplier_payment_state='paid', updated_at=now(), revision=revision+1
      where order_item_id=p_order_id;
  end if;
  if v_order.status='paid' and v_job.state='submitted' and v_state in ('shipped','delivered','cancelled') then
    update public.cqa_order_shipments set state=v_state, carrier=p_tracking->>'carrier',
      tracking_number=p_tracking->>'trackingNumber', tracking_url=p_tracking->>'trackingUrl',
      shipped_at=case when v_state<>'cancelled' then coalesce(shipped_at,now()) else shipped_at end,
      delivered_at=case when v_state='delivered' then coalesce(delivered_at,now()) else delivered_at end,
      updated_at=now(), revision=revision+1
      where order_id=p_order_id and (
        state in ('ready','packing') or state=v_state or (state='shipped' and v_state='delivered')
      ) and (state is distinct from v_state or carrier is distinct from p_tracking->>'carrier'
        or tracking_number is distinct from p_tracking->>'trackingNumber'
        or tracking_url is distinct from p_tracking->>'trackingUrl');
    if v_state='delivered' then
      update public.cqa_product_fulfillment_jobs set state='completed',updated_at=now()
        where order_id=p_order_id and state in ('queued','processing');
    end if;
  end if;
end $$;

revoke all on function public.cqa_supplier_approval(uuid,uuid,integer,text,jsonb),
  public.cqa_supplier_submission_result(uuid,text), public.cqa_supplier_tracking_update(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.cqa_supplier_approval(uuid,uuid,integer,text,jsonb),
  public.cqa_supplier_submission_result(uuid,text), public.cqa_supplier_tracking_update(uuid,text,jsonb) to service_role;
