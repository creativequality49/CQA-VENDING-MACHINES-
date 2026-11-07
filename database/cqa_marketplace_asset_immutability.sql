-- Standalone provisioning SQL: review/apply explicitly; no automatic startup migration.
-- The existing model versions paid files by offer: create a new offer for a new file.
begin;
create or replace function public.cqa_keep_marketplace_asset_immutable()
returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  if nullif(old.fulfillment_config->>'asset_key','') is not null then
    if TG_OP = 'DELETE' then
      raise exception 'An attached digital offer cannot be deleted; archive it instead.';
    end if;
    if new.id is distinct from old.id or new.business_id is distinct from old.business_id
      or new.machine_id is distinct from old.machine_id
      or new.fulfillment_config->>'asset_key' is distinct from old.fulfillment_config->>'asset_key'
      or new.fulfillment_config->>'asset_size_bytes' is distinct from old.fulfillment_config->>'asset_size_bytes'
      or new.fulfillment_config->>'asset_content_type' is distinct from old.fulfillment_config->>'asset_content_type'
      or (old.offer_type='digital_product' or old.fulfillment_type='digital')
         and not coalesce((new.offer_type='digital_product' or new.fulfillment_type='digital'),false) then
      raise exception 'Private digital asset attachments are immutable; create a new offer for a new file.';
    end if;
  end if;
  if TG_OP = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.cqa_keep_marketplace_asset_immutable() from public,anon,authenticated;
drop trigger if exists cqa_marketplace_asset_immutable on public.cqa_offers;
create trigger cqa_marketplace_asset_immutable before update or delete on public.cqa_offers
for each row execute function public.cqa_keep_marketplace_asset_immutable();
commit;
