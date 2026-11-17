-- Turvaülevaatuse parandused (#19): mahajäetud kodud, kodude loomise piirang, undo_done ajapiir.
-- Käivita: npx supabase test db   (vajab `npx supabase start`)
begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.login(user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

select plan(15);

insert into auth.users (id, aud, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'authenticated', 'authenticated'),
  ('cccccccc-0000-4000-8000-000000000001', 'authenticated', 'authenticated');
insert into public.households (id, invite_code) values ('aaaaaaaa-0000-4000-8000-0000000000a0', 'AAAA2222');
insert into public.members (id, household_id, name, position) values
  ('aaaaaaaa-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-0000000000a0', 'Mari', 0),
  ('aaaaaaaa-0000-4000-8000-0000000000a2', 'aaaaaaaa-0000-4000-8000-0000000000a0', 'Jüri', 1);
insert into public.household_users (user_id, household_id) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-0000000000a0'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-0000000000a0');
insert into public.chores (id, household_id, name, current_member_id) values
  ('aaaaaaaa-0000-4000-8000-0000000000c1', 'aaaaaaaa-0000-4000-8000-0000000000a0', 'Prügi',
   'aaaaaaaa-0000-4000-8000-0000000000a1');

-- 1. Mahajäetud kodud
do $$ begin perform pg_temp.login('aaaaaaaa-0000-4000-8000-000000000001'); end $$;
set local role authenticated;
delete from public.household_users where user_id = 'aaaaaaaa-0000-4000-8000-000000000001';
reset role;
select is((select abandoned_at from public.households where id = 'aaaaaaaa-0000-4000-8000-0000000000a0'), null,
  'teine seade on veel kodus: kodu pole mahajäetud');

do $$ begin perform pg_temp.login('aaaaaaaa-0000-4000-8000-000000000002'); end $$;
set local role authenticated;
create temp table fresh as select public.create_household(array['Uus', 'Teine']) as id;
reset role;
select isnt((select abandoned_at from public.households where id = 'aaaaaaaa-0000-4000-8000-0000000000a0'), null,
  'viimane seade läks uude koju: vana kodu on mahajäetud');
select isnt_empty($$select 1 from public.chores where household_id = 'aaaaaaaa-0000-4000-8000-0000000000a0'$$,
  'aga tööd on veel alles (30 päeva)');

-- Kutsekoodiga saab tagasi liituda
do $$ begin perform pg_temp.login('aaaaaaaa-0000-4000-8000-000000000001'); end $$;
set local role authenticated;
select is(public.join_household('AAAA2222'), 'aaaaaaaa-0000-4000-8000-0000000000a0'::uuid, 'tagasi liitumine töötab');
reset role;
select is((select abandoned_at from public.households where id = 'aaaaaaaa-0000-4000-8000-0000000000a0'), null,
  'tagasi liitumine tühjendab abandoned_at');

-- Üle 30 päeva mahajäetud kodu kustutatakse järgmisel loomisel või liitumisel
delete from public.household_users where household_id = 'aaaaaaaa-0000-4000-8000-0000000000a0';
update public.households set abandoned_at = now() - interval '31 days'
  where id = 'aaaaaaaa-0000-4000-8000-0000000000a0';
-- Kodu, kust kaks viimast lahkusid korraga (abandoned_at jäi tühjaks): loetakse created_at järgi.
insert into public.households (id, created_at) values ('dddddddd-0000-4000-8000-0000000000d0', now() - interval '40 days');
insert into public.members (household_id, name, position) values
  ('dddddddd-0000-4000-8000-0000000000d0', 'X', 0), ('dddddddd-0000-4000-8000-0000000000d0', 'Y', 1);
do $$ begin perform pg_temp.login('aaaaaaaa-0000-4000-8000-000000000002'); end $$;
set local role authenticated;
select is(public.join_household('ZZZZ9999'), null, 'suvaline liitumiskatse käivitab koristuse');
reset role;
select is_empty($$select 1 from public.households where id in
  ('aaaaaaaa-0000-4000-8000-0000000000a0', 'dddddddd-0000-4000-8000-0000000000d0')$$,
  'üle 30 päeva mahajäetud kodud kustutati (ka see, kus abandoned_at puudus)');
select isnt_empty('select 1 from public.households where id = (select id from fresh)', 'kasutuses kodu jäi alles');

-- 2. Kodude loomise piirang: 10 tunnis
do $$ begin perform pg_temp.login('cccccccc-0000-4000-8000-000000000001'); end $$;
reset role;
insert into private.household_creations (user_id)
  select 'cccccccc-0000-4000-8000-000000000001' from generate_series(1, 9);
set local role authenticated;
select lives_ok($$select public.create_household(array['A', 'B'])$$, '10. kodu tunnis on lubatud');
select throws_ok($$select public.create_household(array['C', 'D'])$$, 'KM429', null, '11. kodu tunnis lükatakse tagasi');
select is((select count(*)::int from public.household_users), 1, 'tagasilükkamine ei lõhkunud olemasolevat seost');
reset role;
select is((select count(*)::int from public.households where id in (
  select household_id from public.household_users where user_id = 'cccccccc-0000-4000-8000-000000000001')), 1,
  'kasutajal on endiselt üks kodu');

-- 3. undo_done ainult 5 minuti jooksul
insert into public.chores (id, household_id, name, current_member_id)
  select 'cccccccc-0000-4000-8000-0000000000c1', household_id, 'Nõud', (
    select id from public.members m where m.household_id = hu.household_id and position = 0)
  from public.household_users hu where user_id = 'cccccccc-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.mark_done('cccccccc-0000-4000-8000-0000000000c1',
  (select id from public.members where position = 0)), 'ok', 'tehtud');
reset role;
update public.chores set last_done_at = now() - interval '6 minutes' where id = 'cccccccc-0000-4000-8000-0000000000c1';
set local role authenticated;
select is(public.undo_done('cccccccc-0000-4000-8000-0000000000c1'), 'conflict', '6 minuti pärast tagasi võtta ei saa');
reset role;
update public.chores set last_done_at = now() - interval '1 minute' where id = 'cccccccc-0000-4000-8000-0000000000c1';
set local role authenticated;
select is(public.undo_done('cccccccc-0000-4000-8000-0000000000c1'), 'ok', '1 minuti pärast saab tagasi võtta');
reset role;

select * from finish();
rollback;
