-- Kodu loomine (#8).
--
-- create_household(member_names)
--   Loob kodu, selle liikmed (järjekord = massiivi järjekord) ja seob kutsuja
--   seadme koduga. Kõik ühes transaktsioonis, seega poolikut kodu ei teki.
--   Tagastab uue kodu id. Kutsekood tuleb households.invite_code vaikeväärtusest.
--
-- Nimed valideerib server action enne (src/lib/household.ts, cleanMemberNames),
-- et kasutaja saaks eestikeelse veateate. Siin kehtivad lisaks tabelite piirangud
-- (nimi trimmitud ja ≤ 24 märki, nimed unikaalsed, 2–6 liiget), nii et ka otse
-- RPC-d kutsudes ei saa vigast kodu luua.
--
-- Üks seade on korraga ühes kodus: uue kodu loomine eemaldab vana seose.
-- Vana kodu jääb teistele alles.

create function public.create_household(member_names text[])
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

revoke all on function public.create_household(text[]) from public, anon;
grant execute on function public.create_household(text[]) to authenticated;
