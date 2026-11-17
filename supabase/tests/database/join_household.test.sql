-- join_household, new_invite_code ja generate_invite_code (#9).
-- Käivita: npx supabase test db   (vajab `npx supabase start`)
begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.login(user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

select plan(20);

-- Kodu A (kasutaja ua) ja kodu B (kasutaja ub). Kasutaja uc pole kuskil.
insert into auth.users (id, aud, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'authenticated', 'authenticated'),
  ('cccccccc-0000-4000-8000-000000000001', 'authenticated', 'authenticated');
insert into public.households (id, invite_code) values
  ('aaaaaaaa-0000-4000-8000-0000000000a0', 'AAAA2222'),
  ('bbbbbbbb-0000-4000-8000-0000000000b0', 'BBBB3333');
insert into public.members (household_id, name, position) values
  ('aaaaaaaa-0000-4000-8000-0000000000a0', 'Mari', 0),
  ('aaaaaaaa-0000-4000-8000-0000000000a0', 'Jüri', 1),
  ('bbbbbbbb-0000-4000-8000-0000000000b0', 'Teine', 0),
  ('bbbbbbbb-0000-4000-8000-0000000000b0', 'Kolmas', 1);
insert into public.household_users (user_id, household_id) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-0000000000a0'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-0000000000b0');

-- generate_invite_code (käivitab postgres, kliendile see ligipääsetav pole)
select matches(public.generate_invite_code(), '^[A-HJ-KMNP-Z2-9]{8}$', 'kood on 8 märki ilma 0/O/1/I/L-ita');
select isnt(public.generate_invite_code(), public.generate_invite_code(), 'kaks koodi on erinevad');
select unalike(pg_get_functiondef('public.generate_invite_code'::regproc), '%random()%',
  'kood ei kasuta ennustatavat random()-it');

-- Liitumine kasutajana uc
do $$ begin perform pg_temp.login('cccccccc-0000-4000-8000-000000000001'); end $$;
set local role authenticated;

select is(public.join_household('nope-nope'), null, 'vale kood tagastab null');
select is_empty('select 1 from public.households', 'vale koodiga ei näe ühtegi kodu');
select is(public.join_household(' aaaa-2222 '), 'aaaaaaaa-0000-4000-8000-0000000000a0'::uuid,
  'kood töötab väiketähtede, tühikute ja kriipsuga');
select results_eq('select name from public.members order by position', $$values ('Mari'), ('Jüri')$$,
  'pärast liitumist näeb kodu liikmeid');
select lives_ok($$select public.join_household('AAAA2222')$$, 'sama koduga uuesti liitumine ei anna viga');
select is((select count(*)::int from public.household_users), 1, 'topelt seost ei tekkinud');

select is(public.join_household('BBBB3333'), 'bbbbbbbb-0000-4000-8000-0000000000b0'::uuid, 'teise koduga liitumine');
select results_eq('select household_id from public.household_users',
  $$values ('bbbbbbbb-0000-4000-8000-0000000000b0'::uuid)$$, 'seade on korraga ühes kodus');

-- Uus kood (kasutaja uc on nüüd kodus B)
create temp table fresh as select public.new_invite_code() as code;
select isnt((select code from fresh), 'BBBB3333', 'uus kood erineb vanast');
select is((select invite_code from public.households), (select code from fresh), 'kodu sai uue koodi');
select is(public.join_household('BBBB3333'), null, 'vana kood enam ei tööta');

-- Katsete piirang: 10 valet tunnis, siis viga.
-- Seni 2 valet katset ("nope-nope" ja vana kood), lisame 7, kokku 9.
reset role;
insert into private.join_attempts (user_id)
  select 'cccccccc-0000-4000-8000-000000000001' from generate_series(1, 7);
set local role authenticated;
select is(public.join_household('ZZZZ9999'), null, '10. vale katse tagastab veel null');
select throws_ok($$select public.join_household('AAAA2222')$$, 'KM429', null,
  '11. katse annab vea, ka õige koodiga');
reset role;
select is((select count(*)::int from private.join_attempts where user_id = 'cccccccc-0000-4000-8000-000000000001'),
  10, 'piirangu ületamine ise katset juurde ei kirjuta');

-- Õigused
do $$ begin perform pg_temp.login('aaaaaaaa-0000-4000-8000-000000000001'); end $$;
set local role authenticated;
select throws_ok('select * from private.join_attempts', '42501', null, 'katseid ei saa kliendist lugeda');
reset role;
set local role anon;
select throws_ok($$select public.join_household('AAAA2222')$$, '42501', null, 'anon ei saa liituda');
select throws_ok('select public.new_invite_code()', '42501', null, 'anon ei saa koodi vahetada');
reset role;

select * from finish();
rollback;
