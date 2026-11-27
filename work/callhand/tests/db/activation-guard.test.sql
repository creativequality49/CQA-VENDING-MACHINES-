-- Run after migration 0002 in isolated database.
do $$ begin
 if has_column_privilege('authenticated','public.receptionist_settings','enabled','UPDATE') then raise exception 'Browser can activate receptionist'; end if;
end $$;
