-- Turvaülevaatuse parandused (#19).
--
-- 1. Mahajäetud kodud kustutatakse: kui kodust lahkub viimane seade (ise lahkudes,
--    uut kodu luues või teise koduga liitudes), kustutatakse kodu koos liikmete ja
--    töödega. Sinna ei pääseks enam keegi ligi ja andmed jääksid muidu igaveseks.
-- 2. Kodude loomise piirang: 10 kodu tunnis kasutaja kohta (viga KM429), et skript
--    ei saaks andmebaasi lõputult täita.
-- 3. undo_done ainult 5 minuti jooksul. UI näitab "Võta tagasi" 8 sekundit, aga otse
--    API kaudu sai varem ka päevi hiljem tagasi võtta.
-- 4. public.rls_auto_enable(): ühises projektis olemas (mitte meie migratsioonidest),
--    Security Advisor hoiatas, et anon ja authenticated saavad seda kutsuda.

-- 1. Mahajäetud kodud
create function private.delete_abandoned_household()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.household_users where household_id = old.household_id) then
    delete from public.households where id = old.household_id;
  end if;
  return null;
end;
$$;

revoke all on function private.delete_abandoned_household() from public;

create trigger household_users_delete_abandoned
  after delete on public.household_users
  for each row execute function private.delete_abandoned_household();

-- 2. Kodude loomise piirang
create table private.household_creations (
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index household_creations_user_time_idx
  on private.household_creations (user_id, created_at);

alter table private.household_creations enable row level security;
revoke all on private.household_creations from public, anon, authenticated;

-- Nagu 20261117190000_create_household.sql, lisaks piirang.
create or replace function public.create_household(member_names text[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  new_household uuid;
begin
  if caller is null then
    raise exception 'Pole sisse logitud.' using errcode = '28000';
  end if;

  delete from private.household_creations where created_at < now() - interval '1 day';
  if (
    select count(*) from private.household_creations
    where user_id = caller and created_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'Liiga palju uusi kodusid.' using errcode = 'KM429';
  end if;
  insert into private.household_creations (user_id) values (caller);

  delete from public.household_users where user_id = caller;

  insert into public.households default values
  returning id into new_household;

  insert into public.members (household_id, name, position)
  select new_household, member.name, member.ordinality - 1
  from unnest(member_names) with ordinality as member(name, ordinality);

  insert into public.household_users (user_id, household_id)
  values (caller, new_household);

  -- Liikmete arvu (2–6) kontrollib edasilükatud trigger transaktsiooni lõpus.
  return new_household;
end;
$$;

-- 3. undo_done ajapiir. Nagu 20261117210000_soft_delete_chores.sql, lisaks viimane tingimus.
create or replace function public.undo_done(chore_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.chore_household(chore_id, false);

  update public.chores c
  set current_member_id = c.last_member_id,
      last_member_id = c.prev_last_member_id,
      last_done_at = c.prev_last_done_at,
      prev_last_member_id = null,
      prev_last_done_at = null,
      last_done_by = null
  where c.id = chore_id
    and c.removed_at is null
    and c.last_member_id is not null
    and c.last_done_by = (select auth.uid())
    and c.last_done_at > now() - interval '5 minutes';

  if not found then
    return 'conflict';
  end if;
  return 'ok';
end;
$$;

-- 4. rls_auto_enable: ainult seal, kus see on olemas (ühises projektis, mitte lokaalselt).
-- Täpne signatuur kataloogist, sest me ei tea, kas funktsioonil on parameetreid.
do $$
declare
  fn regprocedure;
begin
  for fn in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn);
  end loop;
end;
$$;
