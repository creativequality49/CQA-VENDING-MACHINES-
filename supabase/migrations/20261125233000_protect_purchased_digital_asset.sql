-- New digital orders bind the private file on insert. Preserve that purchase
-- contract through settlement, refunds and catalogue edits. Legacy purchases
-- without historical proof cannot acquire a file binding through an ordinary update.
create or replace function public.cqa_preserve_purchased_digital_asset()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if (old.purchase_snapshot ? 'digitalAsset' or new.purchase_snapshot ? 'digitalAsset')
     and (
       new.purchase_snapshot is distinct from old.purchase_snapshot
       or new.business_id is distinct from old.business_id
       or new.machine_id is distinct from old.machine_id
       or new.offer_id is distinct from old.offer_id
     ) then
    raise exception 'Cannot change the file or catalogue binding of a digital purchase.';
  end if;
  return new;
end;
$$;

revoke all on function public.cqa_preserve_purchased_digital_asset() from public, anon, authenticated;
create trigger cqa_preserve_purchased_digital_asset
before update of purchase_snapshot, business_id, machine_id, offer_id on public.cqa_orders
for each row execute function public.cqa_preserve_purchased_digital_asset();
