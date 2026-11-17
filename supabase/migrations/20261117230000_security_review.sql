-- Turvaülevaatuse parandused (#19).
--
-- 1. Mahajäetud kodud kustutatakse 30 päeva pärast. Kui kodust lahkub viimane seade
--    (ise lahkudes, uut kodu luues või teise koduga liitudes), saab kodu ajatempli
--    abandoned_at. Seni saab kutsekoodiga tagasi liituda ja midagi ei kao (ka siis,
--    kui küpsised kustusid kogemata). Üle 30 päeva mahajäetud kodud kustutatakse koos
--    liikmete ja töödega, kui keegi järgmine kord kodu loob või liitub. Ajastajat
--    (pg_cron) pole vaja. Kodud, kus pole ühtegi seadet, aga abandoned_at puudub
--    (kaks viimast lahkusid täpselt korraga), loetakse created_at järgi.
--    PR #44 ülevaatus: kohe kustutamine kaotaks ühe telefoniga kodu andmed hoiatuseta.
-- 2. Kodude loomise piirang: 10 kodu tunnis kasutaja kohta (viga KM429), et skript
--    ei saaks andmebaasi lõputult täita.
-- 3. undo_done ainult 5 minuti jooksul. UI näitab "Võta tagasi" 8 sekundit, aga otse
--    API kaudu sai varem ka päevi hiljem tagasi võtta.
-- 4. public.rls_auto_enable(): ühises projektis olemas (mitte meie migratsioonidest),
--    Security Advisor hoiatas, et anon ja authenticated saavad seda kutsuda.

-- 1. Mahajäetud kodud
alter table public.households add column abandoned_at timestamptz;

create index households_abandoned_idx
  on public.households (abandoned_at)
  where abandoned_at is not null;

create function private.mark_abandoned_household()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.household_users where household_id = old.household_id) then
    update public.households set abandoned_at = now() where id = old.household_id;
  end if;
  return null;
end;
$$;

revoke all on function private.mark_abandoned_household() from public;

create trigger household_users_mark_abandoned
  after delete on public.household_users
  for each row execute function private.mark_abandoned_household();

create function private.delete_abandoned_households()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.households h
  where coalesce(h.abandoned_at, h.created_at) < now() - interval '30 days'
    and not exists (select 1 from public.household_users hu where hu.household_id = h.id);
$$;

revoke all on function private.delete_abandoned_households() from public;

-- Nagu 20261117200000_join_household.sql, lisaks koristus ja abandoned_at tühjendamine.
create or replace function public.join_household(code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  normalized text := upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g'));
  target uuid;
begin
  if caller is null then
    raise exception 'Pole sisse logitud.' using errcode = '28000';
  end if;

  -- Vanad katsed ja mahajäetud kodud ei loe, koristame need samas ära.
  delete from private.join_attempts where attempted_at < now() - interval '1 day';
  perform private.delete_abandoned_households();

  if (
    select count(*) from private.join_attempts
    where user_id = caller and attempted_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'Liiga palju valesid koode.' using errcode = 'KM429';
  end if;

  select h.id into target from public.households h where h.invite_code = normalized;

  if target is null then
    insert into private.join_attempts (user_id) values (caller);
    return null;
  end if;

  delete from public.household_users where user_id = caller and household_id <> target;
  insert into public.household_users (user_id, household_id)
  values (caller, target)
  on conflict do nothing;
  -- Keegi on jälle kodus: kodu pole enam mahajäetud.
  update public.households set abandoned_at = null where id = target and abandoned_at is not null;

  return target;
end;
$$;

-- 2. Kodude loomise piirang
create table private.household_creations (
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index household_creations_user_time_idx
  on private.household_creations (user_id, created_at);

alter table private.household_creations enable row level security;
revoke all on private.household_creations from public, anon, authenticated;

-- Nagu 20261117190000_create_household.sql, lisaks piirang ja mahajäetud kodude koristus.
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
  perform private.delete_abandoned_households();
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
