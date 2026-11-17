-- import_household (#15).
-- Käivita: npx supabase test db   (vajab `npx supabase start`)
begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.login(user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

select plan(13);

insert into auth.users (id, aud, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'authenticated', 'authenticated');
do $$ begin perform pg_temp.login('aaaaaaaa-0000-4000-8000-000000000001'); end $$;
set local role authenticated;

-- Õnnestunud üleviimine
create temp table imported as select public.import_household(
  array['Mari', 'Jüri'],
  '[{"name": "Prügi", "current": 1, "last": 0, "last_done_at": "2026-11-16T08:00:00Z"},
    {"name": "Nõud", "current": 0, "last": null, "last_done_at": null}]'::jsonb
) as id;

select isnt((select id from imported), null, 'kodu loodi');
select results_eq('select household_id from public.household_users', 'select id from imported',
  'seade on uue koduga seotud');
select results_eq(
  $$select c.name, cm.name, lm.name, c.last_done_at
    from public.chores c
    join public.members cm on cm.id = c.current_member_id
    left join public.members lm on lm.id = c.last_member_id
    order by c.name desc$$,
  $$values ('Prügi', 'Jüri', 'Mari', '2026-11-16T08:00:00Z'::timestamptz),
           ('Nõud', 'Mari', null, null::timestamptz)$$,
  'tööd, järjekord ja "viimati tegi" jäid alles');
select is((select count(*)::int from public.chores where last_done_by is not null), 0,
  'üle viidud "Tehtud"-it ei saa tagasi võtta (last_done_by puudub)');

-- Vigased andmed: midagi ei looda (vana seos jääb)
select throws_ok($$select public.import_household(array['A', 'B'], '{"not": "array"}'::jsonb)$$,
  '22023', null, 'tööd peavad olema massiiv');
select throws_ok($$select public.import_household(array['A', 'B'],
  '[{"name": "X", "current": 2, "last": null, "last_done_at": null}]'::jsonb)$$,
  '22023', null, 'järjekorranumber väljaspool liikmeid');
select throws_ok($$select public.import_household(array['A', 'B'],
  '[{"name": "X", "current": 0, "last": 1, "last_done_at": null}]'::jsonb)$$,
  '22023', null, '"viimati tegi" ilma ajata');
select throws_ok($$select public.import_household(array['A', 'B'],
  '[{"name": "X", "current": 0, "last": 1, "last_done_at": "2999-01-01T00:00:00Z"}]'::jsonb)$$,
  '22023', null, '"viimati tegi" tulevikus');
select throws_ok($$select public.import_household(array['A', 'B'],
  (select jsonb_agg(jsonb_build_object('name', 'T' || i, 'current', 0)) from generate_series(1, 51) i))$$,
  '22023', null, 'üle 50 töö');
select throws_ok($$select public.import_household(array['A', 'B'],
  '[{"name": "Sama", "current": 0}, {"name": "sama", "current": 1}]'::jsonb)$$,
  '23505', null, 'sama nimega töö kaks korda');
select throws_ok($$select public.import_household(array['A', 'B'],
  '[{"name": "  ", "current": 0}]'::jsonb)$$,
  '23514', null, 'tühi töö nimi');
select results_eq('select household_id from public.household_users', 'select id from imported',
  'ebaõnnestunud katsed ei muutnud seadme kodu');

-- Sisse logimata
reset role;
set local role anon;
select throws_ok($$select public.import_household(array['A', 'B'], '[]'::jsonb)$$, '42501', null,
  'anon ei saa üle viia');
reset role;

select * from finish();
rollback;
