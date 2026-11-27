\ir _fixtures.sql

-- ---------------------------------------------------------------------------
-- 1. Reads: each business sees only its own rows.
-- ---------------------------------------------------------------------------
do $$
declare tbl text; mine integer; theirs integer; bad text[] := '{}'; col text;
begin
  foreach tbl in array array['businesses','business_members','receptionist_settings','phone_numbers','calls','alert_deliveries'] loop
    col := case when tbl = 'businesses' then 'id' else 'business_id' end;
    mine := t.count_as('owner_a', format('select count(*) from public.%I where %I = %L', tbl, col, t.id('biz_a')));
    theirs := t.count_as('owner_a', format('select count(*) from public.%I where %I = %L', tbl, col, t.id('biz_b')));
    if mine < 1 then bad := bad || format('%s: cannot read own (%s)', tbl, mine); end if;
    if theirs <> 0 then bad := bad || format('%s: read other business (%s)', tbl, theirs); end if;
  end loop;
  perform t.expect('an owner reads their own business and nothing of another', cardinality(bad) = 0, array_to_string(bad, '; '));

  bad := '{}';
  foreach tbl in array array['businesses','business_members','receptionist_settings','phone_numbers','calls','alert_deliveries'] loop
    theirs := t.count_as('outsider', format('select count(*) from public.%I', tbl));
    if theirs <> 0 then bad := bad || format('%s=%s', tbl, theirs); end if;
  end loop;
  perform t.expect('a signed-in user with no business sees nothing', cardinality(bad) = 0, array_to_string(bad, ', '));

  bad := '{}';
  foreach tbl in array array['businesses','business_members','receptionist_settings','phone_numbers','calls','alert_deliveries'] loop
    theirs := t.count_as('anon', format('select count(*) from public.%I', tbl));
    if theirs > 0 then bad := bad || format('%s=%s', tbl, theirs); end if;
  end loop;
  perform t.expect('anonymous visitors see nothing', cardinality(bad) = 0, array_to_string(bad, ', '));

  perform t.expect('staff read their business''s calls',
    t.count_as('staff_a', format('select count(*) from public.calls where business_id = %L', t.id('biz_a'))) = 1);
  perform t.expect('staff cannot read another business''s calls',
    t.count_as('staff_a', format('select count(*) from public.calls where business_id = %L', t.id('biz_b'))) = 0);
end $$;

-- ---------------------------------------------------------------------------
-- 2. Settings: only the owner of the business can change them.
-- ---------------------------------------------------------------------------
select t.expect_allowed('the owner can update their receptionist settings', 'owner_a',
  format($q$update public.receptionist_settings set hours = 'Mon-Fri 7-5' where business_id = %L$q$, t.id('biz_a')));
select t.expect_denied('an owner cannot update another business''s settings', 'owner_a',
  format($q$update public.receptionist_settings set hours = 'hijacked' where business_id = %L$q$, t.id('biz_b')));
select t.expect_denied('staff cannot change the receptionist settings', 'staff_a',
  format($q$update public.receptionist_settings set greeting = 'Changed by staff member' where business_id = %L$q$, t.id('biz_a')));
select t.expect_denied('an owner cannot move their settings to another business', 'owner_a',
  format($q$update public.receptionist_settings set business_id = %L where business_id = %L$q$, t.id('biz_b'), t.id('biz_a')));
select t.expect_denied('an owner cannot rename another business', 'owner_a',
  format($q$update public.businesses set name = 'Hijacked' where id = %L$q$, t.id('biz_b')));

-- ---------------------------------------------------------------------------
-- 3. Things only the server may write.
-- ---------------------------------------------------------------------------
select t.expect_denied('an owner cannot create calls', 'owner_a',
  format($q$insert into public.calls (business_id, call_sid) values (%L, 'CA' || repeat('c', 32))$q$, t.id('biz_a')));
select t.expect_denied('an owner cannot change captured call details', 'owner_a',
  format($q$update public.calls set job_type = 'edited' where id = %L$q$, t.id('call_a')));
select t.expect_denied('an owner cannot move a call to another business', 'owner_a',
  format($q$update public.calls set business_id = %L where id = %L$q$, t.id('biz_b'), t.id('call_a')));
select t.expect_denied('an owner cannot delete calls', 'owner_a',
  format($q$delete from public.calls where id = %L$q$, t.id('call_a')));
select t.expect_denied('an owner cannot claim a phone number', 'owner_a',
  format($q$insert into public.phone_numbers (business_id, phone_number) values (%L, '+61255550999')$q$, t.id('biz_a')));
select t.expect_denied('an owner cannot take another business''s phone number', 'owner_a',
  format($q$update public.phone_numbers set business_id = %L where phone_number = '+61255550202'$q$, t.id('biz_a')));
select t.expect_denied('an owner cannot write alert records', 'owner_a',
  format($q$insert into public.alert_deliveries (business_id, call_id) values (%L, %L)$q$, t.id('biz_a'), t.id('call_a')));
select t.expect_denied('a user cannot add themselves to another business', 'outsider',
  format($q$insert into public.business_members (business_id, user_id, role) values (%L, %L, 'owner')$q$, t.id('biz_b'), t.id('outsider')));
select t.expect_denied('staff cannot promote themselves to owner', 'staff_a',
  format($q$update public.business_members set role = 'owner' where user_id = %L$q$, t.id('staff_a')));
select t.expect_denied('a signed-in user cannot run the server call-detail function', 'owner_a',
  format($q$select public.merge_call_details('CA' || repeat('a', 32), p_job_type => 'x')$q$));
select t.expect_denied('a signed-in user cannot claim an alert', 'owner_a',
  format($q$select public.claim_call_alert(%L, '+61400000000')$q$, t.id('call_a')));

-- ---------------------------------------------------------------------------
-- 4. Marking a call handled.
-- ---------------------------------------------------------------------------
select t.expect_allowed('staff can mark their business''s call handled', 'staff_a',
  format($q$update public.calls set handled_at = now() where id = %L$q$, t.id('call_a')));
select t.expect_denied('an owner cannot mark another business''s call handled', 'owner_a',
  format($q$update public.calls set handled_at = now() where id = %L$q$, t.id('call_b')));
select t.expect_denied('who handled a call cannot be supplied by the browser', 'owner_a',
  format($q$update public.calls set handled_by = %L where id = %L$q$, t.id('owner_b'), t.id('call_a')));

do $$
declare who uuid;
begin
  perform t.become('staff_a');
  update public.calls set handled_at = now() where id = t.id('call_a');
  reset role;
  select handled_by into who from public.calls where id = t.id('call_a');
  perform t.expect('the database records who marked the call handled', who = t.id('staff_a'), coalesce(who::text, 'null'));
end $$;

-- ---------------------------------------------------------------------------
-- 5. Signup.
-- ---------------------------------------------------------------------------
select t.expect_allowed('a new user can create their business', 'outsider',
  $q$select public.create_business('Charlie Roofing')$q$);
select t.expect_denied('an account cannot create a second business', 'owner_a',
  $q$select public.create_business('Second Business')$q$);
select t.expect_denied('anonymous visitors cannot create a business', 'anon',
  $q$select public.create_business('Anon Business')$q$);

do $$
declare v_business uuid; v_members integer; v_settings integer;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', t.id('outsider'))::text, true);
  v_business := public.create_business('Charlie Roofing');
  perform set_config('request.jwt.claims', '', true);
  select count(*) into v_members from public.business_members where business_id = v_business and user_id = t.id('outsider') and role = 'owner';
  select count(*) into v_settings from public.receptionist_settings where business_id = v_business and not enabled and greeting like '%Charlie Roofing%';
  perform t.expect('signup makes the user owner and starts the receptionist switched off', v_members = 1 and v_settings = 1);
end $$;

-- ---------------------------------------------------------------------------
-- 6. Server call functions.
-- ---------------------------------------------------------------------------
do $$
declare first_claim uuid; second_claim uuid; c record;
begin
  perform t.become('service');
  perform public.merge_call_details('CA' || repeat('a', 32), p_caller_name => 'Alice Smith', p_callback_number => '0412 345 678', p_urgency => 'URGENT');
  perform public.merge_call_details('CA' || repeat('a', 32), p_suburb => 'Newtown', p_caller_name => '  ', p_callback_number => 'not a number', p_urgency => 'whenever');
  first_claim := public.claim_call_alert(t.id('call_b'), '+61400000002');
  reset role;
  select * into c from public.calls where id = t.id('call_a');
  perform t.expect('a later partial save keeps earlier answers', c.caller_name = 'Alice Smith' and c.suburb = 'Newtown' and c.job_type = 'Burst pipe', row_to_json(c)::text);
  perform t.expect('an Australian mobile is stored in international format', c.callback_number = '+61412345678', coalesce(c.callback_number, 'null'));
  perform t.expect('urgency is normalised and junk ignored', c.urgency = 'urgent', coalesce(c.urgency, 'null'));
  perform t.expect('a call that already has an alert cannot be alerted again', first_claim is null);

  perform t.become('service');
  insert into public.calls (business_id, call_sid) values (t.id('biz_a'), 'CA' || repeat('d', 32));
  first_claim := public.claim_call_alert((select id from public.calls where call_sid = 'CA' || repeat('d', 32)), '+61400000001');
  second_claim := public.claim_call_alert((select id from public.calls where call_sid = 'CA' || repeat('d', 32)), '+61400000001');
  reset role;
  perform t.expect('the first claim on a new call wins and the second gets nothing', first_claim is not null and second_claim is null);
end $$;
