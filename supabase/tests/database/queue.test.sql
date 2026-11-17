-- mark_done ja undo_done (#4, #17).
-- Käivita: npx supabase test db   (vajab `npx supabase start`)
-- Samaaegsed vajutused on testis test/db/queue-api.test.ts, sest selleks on vaja
-- kahte eraldi ühendust.
begin;
create extension if not exists pgtap with schema extensions;
-- Logib sisse antud kasutajana (auth.uid()), väljundisse midagi trükkimata.
create function pg_temp.login(user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

select plan(25);

-- Andmed: kodu A kolme liikmega (sisestatud segamini järjekorras, et
-- järjekord tuleks position'ist, mitte lisamise järjekorrast).
-- Kasutajad u1 ja u2 on kodus A, u3 kodus B.
insert into auth.users (id, aud, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'authenticated', 'authenticated');

insert into public.households (id) values
  ('aaaaaaaa-0000-4000-8000-0000000000a0'),
  ('bbbbbbbb-0000-4000-8000-0000000000b0');

insert into public.members (id, household_id, name, position) values
  ('aaaaaaaa-0000-4000-8000-0000000000a3', 'aaaaaaaa-0000-4000-8000-0000000000a0', 'Kati', 2),
  ('aaaaaaaa-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-0000000000a0', 'Mari', 0),
  ('aaaaaaaa-0000-4000-8000-0000000000a2', 'aaaaaaaa-0000-4000-8000-0000000000a0', 'Jüri', 1),
  ('bbbbbbbb-0000-4000-8000-0000000000b1', 'bbbbbbbb-0000-4000-8000-0000000000b0', 'Teine', 0),
  ('bbbbbbbb-0000-4000-8000-0000000000b2', 'bbbbbbbb-0000-4000-8000-0000000000b0', 'Kolmas', 1);

insert into public.household_users (user_id, household_id) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-0000000000a0'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-0000000000a0'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-0000000000b0');

insert into public.chores (id, household_id, name, current_member_id) values
  ('aaaaaaaa-0000-4000-8000-0000000000c1', 'aaaaaaaa-0000-4000-8000-0000000000a0', 'Prügi', 'aaaaaaaa-0000-4000-8000-0000000000a1'),
  ('aaaaaaaa-0000-4000-8000-0000000000c2', 'aaaaaaaa-0000-4000-8000-0000000000a0', 'Pesu', 'aaaaaaaa-0000-4000-8000-0000000000a1'),
  ('bbbbbbbb-0000-4000-8000-0000000000c1', 'bbbbbbbb-0000-4000-8000-0000000000b0', 'Nõud', 'bbbbbbbb-0000-4000-8000-0000000000b1');

-- Kelle kord on töö c1 (liikme nimi), et testid oleksid loetavad.
create function pg_temp.turn() returns text language sql as $$
  select m.name from public.chores c join public.members m on m.id = c.current_member_id
  where c.id = 'aaaaaaaa-0000-4000-8000-0000000000c1'
$$;
create function pg_temp.last() returns text language sql as $$
  select m.name from public.chores c join public.members m on m.id = c.last_member_id
  where c.id = 'aaaaaaaa-0000-4000-8000-0000000000c1'
$$;

-- Kasutajana u1
do $$ begin perform pg_temp.login('aaaaaaaa-0000-4000-8000-000000000001'); end $$;
set local role authenticated;

-- Järjekord liigub position'i järgi ja käib ringiga
select is(public.mark_done('aaaaaaaa-0000-4000-8000-0000000000c1', 'aaaaaaaa-0000-4000-8000-0000000000a1'), 'ok', 'Mari tegi');
select is(pg_temp.turn(), 'Jüri', 'Mari järel on Jüri');
select is(public.mark_done('aaaaaaaa-0000-4000-8000-0000000000c1', 'aaaaaaaa-0000-4000-8000-0000000000a2'), 'ok', 'Jüri tegi');
select is(pg_temp.turn(), 'Kati', 'Jüri järel on Kati');
select is(public.mark_done('aaaaaaaa-0000-4000-8000-0000000000c1', 'aaaaaaaa-0000-4000-8000-0000000000a3'), 'ok', 'Kati tegi');
select is(pg_temp.turn(), 'Mari', 'Kati järel on jälle Mari (ring)');
select is(pg_temp.last(), 'Kati', 'viimati tegi Kati');
select isnt((select last_done_at from public.chores where id = 'aaaaaaaa-0000-4000-8000-0000000000c1'), null, 'last_done_at on salvestatud');

-- Vananenud vajutus: UI näitas Katit, aga järjekord on juba edasi liikunud
select is(public.mark_done('aaaaaaaa-0000-4000-8000-0000000000c1', 'aaaaaaaa-0000-4000-8000-0000000000a3'), 'conflict', 'topeltvajutus annab konflikti');
select is(pg_temp.turn(), 'Mari', 'konflikt ei liiguta järjekorda');

-- Tagasivõtmine
select is(public.undo_done('aaaaaaaa-0000-4000-8000-0000000000c1'), 'ok', 'oma vajutuse saab tagasi võtta');
select is(pg_temp.turn(), 'Kati', 'tagasivõtmine annab korra tagasi Katile');
select is(pg_temp.last(), 'Jüri', 'tagasivõtmine taastab eelmise "viimati tegi"');
select is(public.undo_done('aaaaaaaa-0000-4000-8000-0000000000c1'), 'conflict', 'teist korda tagasi võtta ei saa');

-- undo_done ei tühista teise inimese hilisemat vajutust
select is(public.mark_done('aaaaaaaa-0000-4000-8000-0000000000c1', 'aaaaaaaa-0000-4000-8000-0000000000a3'), 'ok', 'u1 vajutab');
do $$ begin perform pg_temp.login('aaaaaaaa-0000-4000-8000-000000000002'); end $$;
select is(public.mark_done('aaaaaaaa-0000-4000-8000-0000000000c1', 'aaaaaaaa-0000-4000-8000-0000000000a1'), 'ok', 'u2 vajutab hiljem');
do $$ begin perform pg_temp.login('aaaaaaaa-0000-4000-8000-000000000001'); end $$;
select is(public.undo_done('aaaaaaaa-0000-4000-8000-0000000000c1'), 'conflict', 'u1 ei saa u2 hilisemat vajutust tühistada');
select is(pg_temp.turn(), 'Jüri', 'u2 vajutus jäi alles');

-- Esimese vajutuse tagasivõtmine viib töö algseisu
select is(public.mark_done('aaaaaaaa-0000-4000-8000-0000000000c2', 'aaaaaaaa-0000-4000-8000-0000000000a1'), 'ok', 'uus töö: Mari tegi');
select is(public.undo_done('aaaaaaaa-0000-4000-8000-0000000000c2'), 'ok', 'esimese vajutuse saab tagasi võtta');
select results_eq(
  $$select current_member_id, last_member_id, last_done_at from public.chores where id = 'aaaaaaaa-0000-4000-8000-0000000000c2'$$,
  $$values ('aaaaaaaa-0000-4000-8000-0000000000a1'::uuid, null::uuid, null::timestamptz)$$,
  'töö on algseisus');

-- Võõras kodu ja olematu töö annavad sama vea
select throws_ok(
  $$select public.mark_done('bbbbbbbb-0000-4000-8000-0000000000c1', 'bbbbbbbb-0000-4000-8000-0000000000b1')$$,
  'P0002', 'Seda tööd pole olemas.', 'võõra kodu tööd ei saa tehtuks märkida');
select throws_ok(
  $$select public.mark_done(gen_random_uuid(), 'aaaaaaaa-0000-4000-8000-0000000000a1')$$,
  'P0002', 'Seda tööd pole olemas.', 'olematu töö annab sama vea');
select throws_ok(
  $$select public.undo_done('bbbbbbbb-0000-4000-8000-0000000000c1')$$,
  'P0002', 'Seda tööd pole olemas.', 'võõra kodu tööd ei saa tagasi võtta');

-- Sisse logimata kasutaja ei saa funktsioone kutsuda
reset role;
set local role anon;
select throws_ok(
  $$select public.mark_done('aaaaaaaa-0000-4000-8000-0000000000c1', 'aaaaaaaa-0000-4000-8000-0000000000a2')$$,
  '42501', null, 'anon ei saa mark_done-i kutsuda');
reset role;

select * from finish();
rollback;
