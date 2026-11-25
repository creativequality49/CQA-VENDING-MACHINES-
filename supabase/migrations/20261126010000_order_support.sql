begin;

-- Support is separate from payment and fulfilment: refunds must not remove help.
create table public.cqa_order_support (
  order_id uuid primary key references public.cqa_orders(id) on delete cascade,
  business_id uuid not null references public.cqa_businesses(id) on delete cascade,
  state text not null default 'none' check (state in ('none','waiting_owner','waiting_customer','resolved')),
  revision integer not null default 0 check (revision >= 0),
  delivery_confirmed_at timestamptz,
  updated_at timestamptz not null default now()
);
create index cqa_order_support_business_queue_idx on public.cqa_order_support(business_id,state,updated_at desc);

create table public.cqa_order_support_messages (
  id uuid primary key,
  order_id uuid not null references public.cqa_order_support(order_id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role text not null check (actor_role in ('buyer','owner')),
  message text not null check (length(btrim(message)) between 1 and 3000),
  created_at timestamptz not null default now()
);
create index cqa_order_support_messages_order_idx on public.cqa_order_support_messages(order_id,created_at desc,id desc);
create index cqa_order_support_messages_actor_idx on public.cqa_order_support_messages(actor_user_id,created_at desc);

create table public.cqa_order_support_requests (
  request_id uuid primary key,
  order_id uuid not null references public.cqa_order_support(order_id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('message','resolve','reopen','confirm_delivery')),
  message text not null,
  created_at timestamptz not null default now()
);
create index cqa_order_support_requests_actor_idx on public.cqa_order_support_requests(order_id,actor_user_id,created_at desc);

alter table public.cqa_order_support enable row level security;
alter table public.cqa_order_support_messages enable row level security;
alter table public.cqa_order_support_requests enable row level security;
revoke all on public.cqa_order_support,public.cqa_order_support_messages,public.cqa_order_support_requests from public,anon,authenticated;
grant select,insert,update,delete on public.cqa_order_support,public.cqa_order_support_messages,public.cqa_order_support_requests to service_role;

create function public.cqa_update_order_support(
  p_order_id uuid, p_actor_user_id uuid, p_action text, p_message text,
  p_expected_revision integer, p_request_id uuid
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_order public.cqa_orders%rowtype;
  v_thread public.cqa_order_support%rowtype;
  v_request public.cqa_order_support_requests%rowtype;
  v_owner uuid;
  v_role text;
  v_message text := btrim(coalesce(p_message,''));
begin
  if p_order_id is null or p_actor_user_id is null or p_request_id is null
    or p_expected_revision is null or p_expected_revision < 0
    or p_action is null or p_action not in ('message','resolve','reopen','confirm_delivery')
    or length(v_message) > 3000 or (p_action = 'message' and v_message = '')
    or (p_action <> 'message' and v_message <> '') then
    raise exception 'Invalid support request' using errcode = '23514';
  end if;
  -- Serialise support actions with refunds and fulfilment transitions.
  select * into v_order from public.cqa_orders where id=p_order_id for update;
  if not found then raise exception 'Order unavailable' using errcode = 'P0002'; end if;
  select owner_id into v_owner from public.cqa_businesses where id=v_order.business_id;
  if coalesce(v_order.customer_user_id,v_order.buyer_user_id)=p_actor_user_id then v_role := 'buyer';
  elsif v_owner=p_actor_user_id then v_role := 'owner';
  else raise exception 'Order unavailable' using errcode = '42501'; end if;

  insert into public.cqa_order_support(order_id,business_id)
    values(p_order_id,v_order.business_id) on conflict(order_id) do nothing;
  select * into v_thread from public.cqa_order_support where order_id=p_order_id for update;
  if v_thread.business_id <> v_order.business_id then raise exception 'Order unavailable' using errcode = '42501'; end if;

  select * into v_request from public.cqa_order_support_requests where request_id=p_request_id;
  if found then
    if v_request.order_id <> p_order_id or v_request.actor_user_id is distinct from p_actor_user_id
      or v_request.action <> p_action or v_request.message <> v_message then
      raise exception 'Request reference already used' using errcode = '23514';
    end if;
    return jsonb_build_object('support',to_jsonb(v_thread),'request_id',p_request_id);
  end if;
  if v_thread.revision <> p_expected_revision then
    raise exception 'Support changed; refresh and retry' using errcode = '40001';
  end if;
  if (select count(*) from public.cqa_order_support_requests where order_id=p_order_id
    and actor_user_id=p_actor_user_id and created_at > now()-interval '1 minute') >= 20
    or (select count(*) from public.cqa_order_support_requests where order_id=p_order_id
    and actor_user_id=p_actor_user_id and created_at > now()-interval '1 day') >= 200 then
    raise exception 'Too many support updates' using errcode = '54000';
  end if;

  if p_action = 'message' then
    if (select count(*) from public.cqa_order_support_messages where order_id=p_order_id
      and actor_user_id=p_actor_user_id and created_at > now()-interval '1 minute') >= 5
      or (select count(*) from public.cqa_order_support_messages where order_id=p_order_id
      and actor_user_id=p_actor_user_id and created_at > now()-interval '1 day') >= 100 then
      raise exception 'Too many support messages' using errcode = '54000';
    end if;
    insert into public.cqa_order_support_messages(id,order_id,actor_user_id,actor_role,message)
      values(p_request_id,p_order_id,p_actor_user_id,v_role,v_message);
    v_thread.state := case when v_role='buyer' then 'waiting_owner' else 'waiting_customer' end;
  elsif p_action = 'resolve' then
    if v_thread.state not in ('waiting_owner','waiting_customer') then raise exception 'No open support request' using errcode = '23514'; end if;
    v_thread.state := 'resolved';
  elsif p_action = 'reopen' then
    if v_thread.state <> 'resolved' then raise exception 'Support is not resolved' using errcode = '23514'; end if;
    v_thread.state := case when v_role='buyer' then 'waiting_owner' else 'waiting_customer' end;
  else
    if v_role <> 'buyer' then raise exception 'Customer confirmation required' using errcode = '42501'; end if;
    if v_order.status <> 'paid' or not exists(select 1 from public.cqa_order_workspaces
      where order_id=p_order_id and business_id=v_order.business_id and state='delivered') then
      raise exception 'Paid delivery is not ready for confirmation' using errcode = '23514';
    end if;
    if v_thread.delivery_confirmed_at is not null then raise exception 'Delivery already confirmed' using errcode = '23514'; end if;
    v_thread.delivery_confirmed_at := now();
  end if;

  insert into public.cqa_order_support_requests(request_id,order_id,actor_user_id,action,message)
    values(p_request_id,p_order_id,p_actor_user_id,p_action,v_message);
  update public.cqa_order_support set state=v_thread.state,revision=revision+1,
    delivery_confirmed_at=v_thread.delivery_confirmed_at,updated_at=now()
    where order_id=p_order_id returning * into v_thread;
  return jsonb_build_object('support',to_jsonb(v_thread),'request_id',p_request_id);
end;
$$;
revoke all on function public.cqa_update_order_support(uuid,uuid,text,text,integer,uuid) from public,anon,authenticated;
grant execute on function public.cqa_update_order_support(uuid,uuid,text,text,integer,uuid) to service_role;
comment on function public.cqa_update_order_support(uuid,uuid,text,text,integer,uuid)
  is 'Server-only private order support. Routes must verify the actor with Supabase Auth. Never grants payment or download access.';
commit;
