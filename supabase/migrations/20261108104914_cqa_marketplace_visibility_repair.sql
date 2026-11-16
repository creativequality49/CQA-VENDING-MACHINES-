-- Prepared from read-only policy metadata. Validate in the isolated project first.
-- Restrict authenticated non-owners to the same published rows as anonymous users.
-- No grants, owner write policies, orders, or customer data are changed.
begin;

alter policy cqa_offers_owner_select on public.cqa_offers
  to authenticated
  using (
    exists (
      select 1 from public.cqa_businesses b
      where b.id = cqa_offers.business_id
        and b.owner_id = (select auth.uid())
    )
    or (
      cqa_offers.active
      and exists (
        select 1
        from public.cqa_machines m
        join public.cqa_businesses b on b.id = m.business_id
        where m.id = cqa_offers.machine_id
          and m.business_id = cqa_offers.business_id
          and m.status = 'live'
          and b.status = 'live'
      )
    )
  );

alter policy cqa_machines_owner_select on public.cqa_machines
  to authenticated
  using (
    exists (
      select 1 from public.cqa_businesses b
      where b.id = cqa_machines.business_id
        and b.owner_id = (select auth.uid())
    )
    or (
      cqa_machines.status = 'live'
      and exists (
        select 1 from public.cqa_businesses b
        where b.id = cqa_machines.business_id
          and b.status = 'live'
      )
    )
  );

commit;
