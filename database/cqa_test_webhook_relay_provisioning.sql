-- REVIEWED PROVISIONING INPUT, NOT AN AUTOMATIC APPLICATION MIGRATION.
-- Apply only after independently selecting CQA Launch Test project
-- ndzmlywsuywkhgqdbzft. Never apply to Production. No secret values in this file.
-- Supabase CLI is not installed in the preparation workspace; this standalone
-- script intentionally does not invent a migration-history filename.
begin;

-- Supabase Vault must already be available. Create secret VALUES separately
-- through the protected Vault interface under these unique names:
-- cqa_test_webhook_preview_origin
-- cqa_test_webhook_bypass_token
-- cqa_test_webhook_platform_signing_secret
-- cqa_test_webhook_connect_signing_secret
-- Do not grant clients access to vault.decrypted_secrets.
create or replace function public.cqa_test_webhook_config(p_route text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  result jsonb;
begin
  if p_route not in ('platform', 'connect') or p_route is null then
    raise exception 'Invalid relay route';
  end if;
  select pg_catalog.jsonb_build_object(
    'preview_origin', (select decrypted_secret from vault.decrypted_secrets where name = 'cqa_test_webhook_preview_origin'),
    'protection_bypass', (select decrypted_secret from vault.decrypted_secrets where name = 'cqa_test_webhook_bypass_token'),
    'stripe_signing_secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cqa_test_webhook_' || p_route || '_signing_secret')
  ) into result;
  if result->>'preview_origin' is null or result->>'protection_bypass' is null or result->>'stripe_signing_secret' is null then
    raise exception 'Relay configuration unavailable';
  end if;
  return result;
end;
$$;
alter function public.cqa_test_webhook_config(text) owner to postgres;
revoke all on function public.cqa_test_webhook_config(text) from public, anon, authenticated;
grant execute on function public.cqa_test_webhook_config(text) to service_role;
comment on function public.cqa_test_webhook_config(text) is 'TEST ONLY: service_role receiver configuration from encrypted Vault; never expose to browsers.';
commit;
