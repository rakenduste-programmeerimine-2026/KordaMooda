-- Tööde pehme kustutamine: remove_chore ja restore_chore (#10).
-- Käivita: npx supabase test db   (vajab `npx supabase start`)
begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.login(user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

select plan(17);

insert into auth.users (id, aud, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'authenticated', 'authenticated');
insert into public.households (id) values ('aaaaaaaa-0000-4000-8000-0000000000a0');
insert into public.members (id, household_id, name, position) values
  ('aaaaaaaa-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-0000000000a0', 'Mari', 0),
  ('aaaaaaaa-0000-4000-8000-0000000000a2', 'aaaaaaaa-0000-4000-8000-0000000000a0', 'Jüri', 1);
insert into public.household_users (user_id, household_id) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-0000000000a0');
insert into public.chores (id, household_id, name, current_member_id, created_at) values
  ('aaaaaaaa-0000-4000-8000-0000000000c1', 'aaaaaaaa-0000-4000-8000-0000000000a0', 'Prügi',
   'aaaaaaaa-0000-4000-8000-0000000000a1', now() - interval '2 minutes'),
  ('aaaaaaaa-0000-4000-8000-0000000000c2', 'aaaaaaaa-0000-4000-8000-0000000000a0', 'Nõud',
   'aaaaaaaa-0000-4000-8000-0000000000a1', now() - interval '1 minute');

do $$ begin perform pg_temp.login('aaaaaaaa-0000-4000-8000-000000000001'); end $$;
set local role authenticated;

-- Ajalugu enne eemaldamist
select is(public.mark_done('aaaaaaaa-0000-4000-8000-0000000000c1', 'aaaaaaaa-0000-4000-8000-0000000000a1'), 'ok', 'Mari tegi Prügi');

-- Eemaldamine
select is(public.remove_chore('aaaaaaaa-0000-4000-8000-0000000000c1'), 'ok', 'töö eemaldatakse');
select results_eq('select name from public.chores', $$values ('Nõud')$$, 'eemaldatud töö pole nähtav');
select is(public.remove_chore('aaaaaaaa-0000-4000-8000-0000000000c1'), 'ok', 'teist korda eemaldamine ei anna viga');
select throws_ok($$select public.mark_done('aaaaaaaa-0000-4000-8000-0000000000c1', 'aaaaaaaa-0000-4000-8000-0000000000a2')$$,
  'P0002', 'Seda tööd pole olemas.', 'eemaldatud tööd ei saa tehtuks märkida');
select is_empty($$update public.chores set name = 'X' where id = 'aaaaaaaa-0000-4000-8000-0000000000c1' returning id$$,
  'eemaldatud tööd ei saa ümber nimetada');

-- Tagasivõtmine: ajalugu ja koht nimekirjas jäävad
select is(public.restore_chore('aaaaaaaa-0000-4000-8000-0000000000c1'), 'ok', 'töö tuleb tagasi');
select results_eq('select name from public.chores order by created_at', $$values ('Prügi'), ('Nõud')$$,
  'tagasi tulnud töö on oma endisel kohal');
select results_eq(
  $$select current_member_id, last_member_id from public.chores where id = 'aaaaaaaa-0000-4000-8000-0000000000c1'$$,
  $$values ('aaaaaaaa-0000-4000-8000-0000000000a2'::uuid, 'aaaaaaaa-0000-4000-8000-0000000000a1'::uuid)$$,
  'järjekord ja "viimati tegi" jäid alles');
select is(public.restore_chore('aaaaaaaa-0000-4000-8000-0000000000c1'), 'conflict', 'teist korda tagasi võtta ei saa');

-- Sama nimi pärast eemaldamist
select is(public.remove_chore('aaaaaaaa-0000-4000-8000-0000000000c2'), 'ok', 'Nõud eemaldatakse');
select lives_ok($$insert into public.chores (household_id, name, current_member_id)
  values ('aaaaaaaa-0000-4000-8000-0000000000a0', 'nõud', 'aaaaaaaa-0000-4000-8000-0000000000a2')$$,
  'eemaldatud tööga sama nime saab uuesti lisada');
select is(public.restore_chore('aaaaaaaa-0000-4000-8000-0000000000c2'), 'duplicate',
  'vana tööd ei saa tagasi panna, kui sama nimi on uuesti lisatud');

-- Vanad eemaldatud tööd koristatakse
reset role;
update public.chores set removed_at = now() - interval '2 days' where id = 'aaaaaaaa-0000-4000-8000-0000000000c2';
set local role authenticated;
select lives_ok($$select public.remove_chore('aaaaaaaa-0000-4000-8000-0000000000c1')$$, 'järgmine eemaldamine');
reset role;
select is_empty($$select 1 from public.chores where id = 'aaaaaaaa-0000-4000-8000-0000000000c2'$$,
  'üle päeva tagasi eemaldatud töö kustutati päriselt');
select isnt((select removed_at from public.chores where id = 'aaaaaaaa-0000-4000-8000-0000000000c1'), null,
  'äsja eemaldatud töö jäi alles');

-- Sisse logimata
set local role anon;
select throws_ok($$select public.remove_chore('aaaaaaaa-0000-4000-8000-0000000000c1')$$, '42501', null,
  'anon ei saa eemaldada');
reset role;

select * from finish();
rollback;
