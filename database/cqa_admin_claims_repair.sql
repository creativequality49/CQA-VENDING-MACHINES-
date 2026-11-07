-- Review the deployed function and apply explicitly through the database owner.
-- A SQL source change alone does not update a running Supabase database.
-- Never use user-editable profile metadata for RLS administrator authority.
begin;
create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path=pg_catalog,public
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;
commit;
