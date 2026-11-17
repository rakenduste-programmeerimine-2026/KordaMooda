-- create_household (#8).
-- Käivita: npx supabase test db   (vajab `npx supabase start`)
begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.login(user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

select plan(12);

insert into auth.users (id, aud, role) values
  ('cccccccc-0000-4000-8000-000000000001', 'authenticated', 'authenticated');

do $$ begin perform pg_temp.login('cccccccc-0000-4000-8000-000000000001'); end $$;
set local role authenticated;

-- Loomine
create temp table created as
  select public.create_household(array['Mari', 'Jüri', 'Kati']) as id;
select isnt((select id from created), null, 'tagastab uue kodu id');
select results_eq(
  'select name, position from public.members order by position',
  $$values ('Mari', 0), ('Jüri', 1), ('Kati', 2)$$,
  'liikmed on antud järjekorras');
select results_eq(
  'select household_id from public.household_users',
  'select id from created',
  'seade on uue koduga seotud');
select matches(
  (select invite_code from public.households),
  '^[A-HJ-KMNP-Z2-9]{8}$',
  'kodul on 8-märgiline kutsekood ilma 0/O/1/I/L-ita');
select is(private.is_household_member((select id from created)), true, 'kutsuja on liige');

-- Teine kodu: vana seos kaob, vana kodu jääb alles
select lives_ok($$select public.create_household(array['Uus', 'Teine'])$$, 'teise kodu loomine');
select is((select count(*)::int from public.household_users), 1, 'seade on korraga ühes kodus');
select is_empty(
  $$select 1 from public.household_users where household_id = (select id from created)$$,
  'vana seos eemaldati');

-- Vigane sisend ei loo midagi (liikmete arvu kontrollib trigger transaktsiooni lõpus,
-- seega savepoint'i sees, et viga ei katkestaks kogu testi)
select throws_ok($$select public.create_household(array['  Mari  ', 'Jüri'])$$,
  '23514', null, 'trimmimata nimi lükatakse tagasi');
select throws_ok($$select public.create_household(array['Mari', 'mari'])$$,
  '23505', null, 'sama nimi kaks korda lükatakse tagasi');
select throws_ok($$select public.create_household(array['x', 'y', 'z', 'q', 'w', 'e', 'r'])$$,
  '23514', null, 'üle 6 liikme lükatakse tagasi');

-- Sisse logimata
reset role;
set local role anon;
select throws_ok($$select public.create_household(array['A', 'B'])$$,
  '42501', null, 'anon ei saa kodu luua');
reset role;

select * from finish();
rollback;
