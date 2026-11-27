-- Shared helpers and fixtures for tests/db/*.test.sql (included with \ir).
-- Each test file runs in its own fresh copy of the migrated database.
--
-- Probes run as the real browser roles (`authenticated` / `anon`, with the
-- JWT claims PostgREST would set) inside a subtransaction that is always
-- rolled back, so a probe that wrongly succeeds is reported and leaves no
-- trace. Results are NOTICE lines starting with PASS or FAIL.

set client_min_messages = notice;
create schema t;

create table t.ids (key text primary key, id uuid not null);
create function t.id(k text) returns uuid language sql stable as $$ select id from t.ids where key = k $$;

create function t.become(actor text) returns void language plpgsql as $$
begin
  if actor = 'anon' then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    execute 'set local role anon';
  elsif actor = 'service' then
    perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
    execute 'set local role service_role';
  else
    perform set_config('request.jwt.claims', json_build_object('sub', t.id(actor), 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
  end if;
end $$;

-- Runs a scalar query as `actor` (-1 when refused outright).
create function t.count_as(actor text, query text) returns integer language plpgsql as $$
declare result integer;
begin
  begin
    perform t.become(actor);
    execute query into result;
    raise exception 'probe_done';
  exception when others then
    if sqlerrm <> 'probe_done' then result := -1; end if;
  end;
  return result;
end $$;

-- Runs a write as `actor`; returns 'denied: <error>' or the affected row count.
create function t.write_as(actor text, statement text) returns text language plpgsql as $$
declare affected integer; outcome text;
begin
  begin
    perform t.become(actor);
    execute statement;
    get diagnostics affected = row_count;
    outcome := affected::text;
    raise exception 'probe_done';
  exception when others then
    if sqlerrm <> 'probe_done' then outcome := 'denied: ' || sqlerrm; end if;
  end;
  return outcome;
end $$;

create function t.expect(name text, ok boolean, detail text default '') returns void language plpgsql as $$
begin
  if ok then raise notice 'PASS %', name;
  else raise notice 'FAIL % %', name, detail;
  end if;
end $$;

create function t.expect_denied(name text, actor text, statement text) returns void language plpgsql as $$
declare outcome text := t.write_as(actor, statement);
begin
  perform t.expect(name, outcome like 'denied:%' or outcome = '0', '(succeeded, rows: ' || outcome || ')');
end $$;

create function t.expect_allowed(name text, actor text, statement text) returns void language plpgsql as $$
declare outcome text := t.write_as(actor, statement);
begin
  perform t.expect(name, outcome !~ '^(denied|0$)', '(' || outcome || ')');
end $$;

-- ---------------------------------------------------------------------------
-- Fixtures: two businesses (created through the real signup RPC), a staff
-- member in A, and a signed-in outsider with no business.
-- ---------------------------------------------------------------------------
insert into t.ids values
  ('owner_a',  '0a000000-0000-4000-8000-00000000000a'),
  ('owner_b',  '0b000000-0000-4000-8000-00000000000b'),
  ('staff_a',  '05000000-0000-4000-8000-00000000005a'),
  ('outsider', '0f000000-0000-4000-8000-00000000000f');
insert into auth.users (id, email) select id, key || '@example.test' from t.ids;

do $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', t.id('owner_a'))::text, true);
  insert into t.ids values ('biz_a', public.create_business('Alpha Plumbing'));
  perform set_config('request.jwt.claims', json_build_object('sub', t.id('owner_b'))::text, true);
  insert into t.ids values ('biz_b', public.create_business('Bravo Electrical'));
  perform set_config('request.jwt.claims', '', true);
end $$;

insert into public.business_members (business_id, user_id, role) values (t.id('biz_a'), t.id('staff_a'), 'staff');
insert into public.phone_numbers (business_id, phone_number) values
  (t.id('biz_a'), '+61255550101'), (t.id('biz_b'), '+61255550202');

insert into public.calls (business_id, call_sid, from_number, to_number, status, caller_name, job_type)
values
  (t.id('biz_a'), 'CA' || repeat('a', 32), '+61412000001', '+61255550101', 'completed', 'Alice', 'Burst pipe'),
  (t.id('biz_b'), 'CA' || repeat('b', 32), '+61412000002', '+61255550202', 'completed', 'Bob', 'No power');
insert into t.ids select 'call_a', id from public.calls where call_sid = 'CA' || repeat('a', 32);
insert into t.ids select 'call_b', id from public.calls where call_sid = 'CA' || repeat('b', 32);
insert into public.alert_deliveries (business_id, call_id, recipient, status)
values (t.id('biz_a'), t.id('call_a'), '+61400000001', 'sent'), (t.id('biz_b'), t.id('call_b'), '+61400000002', 'sent');

-- Probes that switch role mid-block still need the test helpers.
grant usage on schema t to anon, authenticated, service_role;
grant select on t.ids to anon, authenticated, service_role;
grant execute on all functions in schema t to anon, authenticated, service_role;
