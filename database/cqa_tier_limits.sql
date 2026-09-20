-- Enforce product slot and integration limits from the purchased business plan.

create or replace function public.cqa_enforce_offer_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_plan text;
  v_limit integer;
  v_count integer;
begin
  select plan into v_plan from public.cqa_businesses where id = new.business_id;
  v_limit := case v_plan when 'starter' then 4 when 'pro' then 20 else 10000 end;

  select count(*) into v_count
  from public.cqa_offers
  where business_id = new.business_id
    and (tg_op <> 'UPDATE' or id <> new.id);

  if v_count >= v_limit then
    raise exception 'CQA plan offer limit reached (% slots).', v_limit;
  end if;

  return new;
end;
$$;

drop trigger if exists cqa_offers_plan_limit on public.cqa_offers;
create trigger cqa_offers_plan_limit
before insert on public.cqa_offers
for each row execute function public.cqa_enforce_offer_limit();

create or replace function public.cqa_enforce_connection_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_plan text;
  v_limit integer;
  v_count integer;
begin
  select plan into v_plan from public.cqa_businesses where id = new.business_id;
  v_limit := case v_plan when 'starter' then 2 when 'pro' then 6 else 20 end;

  select count(*) into v_count
  from public.cqa_business_connections
  where business_id = new.business_id
    and provider <> new.provider;

  if v_count >= v_limit then
    raise exception 'CQA plan integration limit reached (% connections).', v_limit;
  end if;

  return new;
end;
$$;

drop trigger if exists cqa_connections_plan_limit on public.cqa_business_connections;
create trigger cqa_connections_plan_limit
before insert on public.cqa_business_connections
for each row execute function public.cqa_enforce_connection_limit();
