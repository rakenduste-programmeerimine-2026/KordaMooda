-- RLS: kasutaja näeb ja muudab ainult oma kodu andmeid (#3, #17).
-- Käivita: npx supabase test db   (vajab `npx supabase start`)
-- Kõik jookseb ühes transaktsioonis, mis lõpus tagasi keeratakse.
begin;
create extension if not exists pgtap with schema extensions;
-- Logib sisse antud kasutajana (auth.uid()), väljundisse midagi trükkimata.
create function pg_temp.login(user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

select plan(32);

-- Andmed: kaks kodu (A ja B), kummaski kaks liiget ja üks töö.
-- Kasutaja ua on kodus A, kasutaja ub kodus B.
insert into auth.users (id, aud, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'authenticated', 'authenticated');

insert into public.households (id) values
  ('aaaaaaaa-0000-4000-8000-0000000000a0'),
  ('bbbbbbbb-0000-4000-8000-0000000000b0');

insert into public.members (id, household_id, name, position) values
  ('aaaaaaaa-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-0000000000a0', 'Mari', 0),
  ('aaaaaaaa-0000-4000-8000-0000000000a2', 'aaaaaaaa-0000-4000-8000-0000000000a0', 'Jüri', 1),
  ('bbbbbbbb-0000-4000-8000-0000000000b1', 'bbbbbbbb-0000-4000-8000-0000000000b0', 'Teine', 0),
  ('bbbbbbbb-0000-4000-8000-0000000000b2', 'bbbbbbbb-0000-4000-8000-0000000000b0', 'Kolmas', 1);

insert into public.household_users (user_id, household_id) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-0000000000a0'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-0000000000b0');

insert into public.chores (id, household_id, name, current_member_id) values
  ('aaaaaaaa-0000-4000-8000-0000000000c1', 'aaaaaaaa-0000-4000-8000-0000000000a0', 'Prügi', 'aaaaaaaa-0000-4000-8000-0000000000a1'),
  ('bbbbbbbb-0000-4000-8000-0000000000c1', 'bbbbbbbb-0000-4000-8000-0000000000b0', 'Nõud', 'bbbbbbbb-0000-4000-8000-0000000000b1');

-- Sisse logimata kasutaja (roll anon) ei näe midagi.
set local role anon;
select throws_ok('select * from public.households', '42501', null, 'anon ei saa kodusid lugeda');
select throws_ok('select * from public.members', '42501', null, 'anon ei saa liikmeid lugeda');
select throws_ok('select * from public.chores', '42501', null, 'anon ei saa töid lugeda');
select throws_ok('select * from public.household_users', '42501', null, 'anon ei saa seoseid lugeda');
reset role;

-- Edasi kasutajana ua (kodu A).
do $$ begin perform pg_temp.login('aaaaaaaa-0000-4000-8000-000000000001'); end $$;
set local role authenticated;

-- Lugemine
select results_eq('select id from public.households',
  $$values ('aaaaaaaa-0000-4000-8000-0000000000a0'::uuid)$$, 'näeb ainult oma kodu');
select is_empty($$select invite_code from public.households where id = 'bbbbbbbb-0000-4000-8000-0000000000b0'$$,
  'võõra kodu kutsekood pole nähtav');
select results_eq('select name from public.members order by position',
  $$values ('Mari'), ('Jüri')$$, 'näeb ainult oma kodu liikmeid');
select results_eq('select name from public.chores',
  $$values ('Prügi')$$, 'näeb ainult oma kodu töid');
select results_eq('select household_id from public.household_users',
  $$values ('aaaaaaaa-0000-4000-8000-0000000000a0'::uuid)$$, 'näeb ainult oma seost');
select is(private.is_household_member('aaaaaaaa-0000-4000-8000-0000000000a0'), true, 'is_household_member: oma kodu');
select is(private.is_household_member('bbbbbbbb-0000-4000-8000-0000000000b0'), false, 'is_household_member: võõras kodu');

-- Võõra kodu muutmine
select throws_ok(
  $$insert into public.chores (household_id, name, current_member_id)
    values ('bbbbbbbb-0000-4000-8000-0000000000b0', 'Pesu', 'bbbbbbbb-0000-4000-8000-0000000000b1')$$,
  '42501', null, 'ei saa võõrasse koju tööd lisada');
update public.chores set name = 'Häkitud' where id = 'bbbbbbbb-0000-4000-8000-0000000000c1';
select throws_ok($$delete from public.chores where id = 'bbbbbbbb-0000-4000-8000-0000000000c1'$$,
  '42501', null, 'otse kustutada ei saa (ainult remove_chore, #10)');
select throws_ok($$select public.remove_chore('bbbbbbbb-0000-4000-8000-0000000000c1')$$,
  'P0002', 'Seda tööd pole olemas.', 'võõra kodu tööd ei saa eemaldada');
select throws_ok(
  $$update public.chores set household_id = 'bbbbbbbb-0000-4000-8000-0000000000b0'
    where id = 'aaaaaaaa-0000-4000-8000-0000000000c1'$$,
  '42501', null, 'ei saa oma tööd teise koju tõsta');
select throws_ok(
  $$insert into public.household_users (user_id, household_id)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-0000000000b0')$$,
  '42501', null, 'ei saa end ise võõrasse koju lisada');

-- Asjad, mis käivad ainult RPC kaudu
select throws_ok($$update public.households set invite_code = 'AAAAAAAA'$$,
  '42501', null, 'ei saa kutsekoodi ise valida');
select throws_ok('insert into public.households default values',
  '42501', null, 'ei saa kodu otse luua');
select throws_ok(
  $$insert into public.members (household_id, name, position)
    values ('aaaaaaaa-0000-4000-8000-0000000000a0', 'Uus', 2)$$,
  '42501', null, 'ei saa liiget otse lisada');
select throws_ok(
  $$update public.chores set current_member_id = 'aaaaaaaa-0000-4000-8000-0000000000a2'
    where id = 'aaaaaaaa-0000-4000-8000-0000000000c1'$$,
  '42501', null, 'ei saa järjekorda otse muuta');
select throws_ok('select public.generate_invite_code()',
  '42501', null, 'generate_invite_code pole kliendist kutsutav');

-- Oma kodus töötab
select lives_ok(
  $$insert into public.chores (household_id, name, current_member_id)
    values ('aaaaaaaa-0000-4000-8000-0000000000a0', 'Pesu', 'aaaaaaaa-0000-4000-8000-0000000000a2')$$,
  'saab oma koju tööd lisada');
select throws_ok(
  $$insert into public.chores (household_id, name, current_member_id)
    values ('aaaaaaaa-0000-4000-8000-0000000000a0', 'Aknad', 'bbbbbbbb-0000-4000-8000-0000000000b1')$$,
  '23503', null, 'töö ei saa minna teise kodu liikmele');
select lives_ok(
  $$update public.chores set name = 'Prügi välja' where id = 'aaaaaaaa-0000-4000-8000-0000000000c1'$$,
  'saab oma töö nime muuta');
select lives_ok($$select public.remove_chore((select id from public.chores where name = 'Pesu'))$$,
  'saab oma kodust töö eemaldada (pehme kustutamine, #10)');
select results_eq('select name from public.chores', $$values ('Prügi välja')$$, 'oma kodu muudatused jäid alles');

-- Koduga lahkumine
select lives_ok($$delete from public.household_users where user_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  'saab kodust lahkuda');
select is_empty('select 1 from public.chores', 'pärast lahkumist ei näe kodu töid');
select is_empty('select 1 from public.households', 'pärast lahkumist ei näe kodu');

-- Kontroll ilma RLS-ita: võõra kodu andmed jäid puutumata.
reset role;
select results_eq(
  $$select name from public.chores where id = 'bbbbbbbb-0000-4000-8000-0000000000c1'$$,
  $$values ('Nõud')$$, 'võõra kodu tööd ei muudetud ega kustutatud');
select results_eq(
  $$select count(*)::int from public.household_users where household_id = 'bbbbbbbb-0000-4000-8000-0000000000b0'$$,
  $$values (1)$$, 'võõrasse koju ei lisandunud kedagi');
select is(
  (select count(*)::int from public.members where household_id = 'aaaaaaaa-0000-4000-8000-0000000000a0'),
  2, 'kodu A liikmed jäid alles pärast lahkumist');

select * from finish();
rollback;
