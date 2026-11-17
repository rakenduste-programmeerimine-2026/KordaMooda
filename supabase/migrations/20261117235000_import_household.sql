-- Vana nimekirja üleviimine brauserist serverisse (#15).
--
-- import_household(member_names, chores)
--   Loob kodu nagu create_household (sama sisselogimise kontroll, 10 kodu tunnis
--   piirang ja seadme sidumine) ning lisab tööd koos järjekorra ja "viimati tegi"
--   infoga, kõik ühes transaktsioonis.
--
--   chores on JSON massiiv: [{ "name": "Prügi", "current": 1, "last": 0,
--   "last_done_at": "2026-11-16T08:00:00Z" }, ...]. "current" ja "last" on liikme
--   järjekorranumbrid (0 = esimene nimi), mitte id-d, sest neid saab ainult siin luua.
--
-- Server action (src/lib/supabase/households.ts) kontrollib andmed enne üle
-- (householdFromSaved). RPC-d saab aga kutsuda ka otse, seega kontrollib see ise:
-- kuni 50 tööd, järjekorranumbrid olemas olevate liikmete piires, "viimati tegi"
-- ainult koos ajaga ja mitte tulevikus. Nimed kontrollivad tabelite piirangud.
-- Ajalugu, mida siin kirjutada saab, puudutab ainult kutsuja enda uut kodu.

create function public.import_household(member_names text[], chores jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_household uuid;
  member_ids uuid[];
  member_count int;
  chore jsonb;
  current_index int;
  last_index int;
  last_at timestamptz;
begin
  if jsonb_typeof(chores) is distinct from 'array' or jsonb_array_length(chores) > 50 then
    raise exception 'Vigane nimekiri.' using errcode = '22023';
  end if;

  -- Sisselogimine, piirang, liikmed ja seadme seos.
  new_household := public.create_household(member_names);

  select array_agg(m.id order by m.position), count(*)
  into member_ids, member_count
  from public.members m
  where m.household_id = new_household;

  for chore in select value from jsonb_array_elements(chores) loop
    current_index := (chore ->> 'current')::int;
    last_index := (chore ->> 'last')::int;
    last_at := (chore ->> 'last_done_at')::timestamptz;

    if current_index is null
      or current_index not between 0 and member_count - 1
      or (last_index is null) <> (last_at is null)
      or last_index not between 0 and member_count - 1
      or last_at > now()
    then
      raise exception 'Vigane nimekiri.' using errcode = '22023';
    end if;

    insert into public.chores (household_id, name, current_member_id, last_member_id, last_done_at)
    values (
      new_household,
      chore ->> 'name',
      member_ids[current_index + 1],
      member_ids[last_index + 1],
      last_at
    );
  end loop;

  return new_household;
end;
$$;

revoke all on function public.import_household(text[], jsonb) from public, anon;
grant execute on function public.import_household(text[], jsonb) to authenticated;
