-- RLS reeglid: igaüks näeb ja muudab ainult oma kodu andmeid (#3).
--
-- Kodu liige on Supabase'i kasutaja (ka anonüümne), kelle auth.uid() on tabelis
-- household_users. Anonüümselt sisse loginud kasutajal on roll `authenticated`,
-- seega rollil `anon` (pole üldse sisse logitud) pole ligipääsu millelegi.
--
-- Mis käib otse tabelite kaudu (vastavalt API lepingule src/lib/actions.ts):
--   households       select
--   members          select
--   chores           select, insert, update, delete
--   household_users  select ja delete oma rea kohta (koduga lahkumine)
--
-- Mis käib ainult security definer RPC-de kaudu (pole siin lubatud):
--   kodu ja liikmete loomine (#8), koduga liitumine ja uus kutsekood (#9).
-- Nii ei saa keegi end ise suvalisse koju lisada ega kutsekoodi ise valida.

-- RLS on kõigil tabelitel juba sees (20261117175516_initial_schema.sql),
-- siin igaks juhuks uuesti, et see fail oleks iseseisvalt loetav.
alter table public.households enable row level security;
alter table public.members enable row level security;
alter table public.chores enable row level security;
alter table public.household_users enable row level security;

-- Abifunktsioon eraldi skeemis, mida PostgREST välja ei näita,
-- nii et seda ei saa /rest/v1/rpc kaudu kutsuda.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- security definer: loeb household_users tabelit RLS-ist mööda, muidu
-- tekiks reeglite vahel lõputu rekursioon. Tagastab ainult jah/ei
-- kutsuja enda liikmesuse kohta.
create function private.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_users
    where household_id = target_household_id
      and user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_household_member(uuid) from public;
grant execute on function private.is_household_member(uuid) to authenticated;

-- Õigused. Supabase annab vaikimisi anon/authenticated rollidele kõik õigused
-- ja jätab piiramise RLS-i hooleks. Võtame liigsed ära, et ka mõni hiljem
-- kogemata lisatud reegel ei avaks rohkem, kui siin mõeldud.
revoke all on public.households, public.members, public.chores, public.household_users
  from anon, authenticated;

grant select on public.households to authenticated;
grant select on public.members to authenticated;
grant select, insert, delete on public.chores to authenticated;
-- Tööd ei saa teise koju tõsta ega id-d muuta.
grant update (name, current_member_id, last_member_id, last_done_at)
  on public.chores to authenticated;
grant select, delete on public.household_users to authenticated;

revoke execute on function public.generate_invite_code() from public, anon, authenticated;

-- households: näeb ainult oma kodu, sh kutsekoodi.
create policy "Liige näeb oma kodu"
  on public.households for select
  to authenticated
  using ((select private.is_household_member(id)));

-- members: näeb oma kodu liikmeid.
create policy "Liige näeb oma kodu liikmeid"
  on public.members for select
  to authenticated
  using ((select private.is_household_member(household_id)));

-- chores: kõik toimingud ainult oma kodus.
create policy "Liige näeb oma kodu töid"
  on public.chores for select
  to authenticated
  using ((select private.is_household_member(household_id)));

create policy "Liige lisab töid oma koju"
  on public.chores for insert
  to authenticated
  with check ((select private.is_household_member(household_id)));

create policy "Liige muudab oma kodu töid"
  on public.chores for update
  to authenticated
  using ((select private.is_household_member(household_id)))
  with check ((select private.is_household_member(household_id)));

create policy "Liige eemaldab oma kodu töid"
  on public.chores for delete
  to authenticated
  using ((select private.is_household_member(household_id)));

-- household_users: näeb ainult oma seoseid ja saab ise lahkuda.
-- Lisamine ainult RPC kaudu (#8, #9).
create policy "Kasutaja näeb oma kodusid"
  on public.household_users for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Kasutaja saab kodust lahkuda"
  on public.household_users for delete
  to authenticated
  using (user_id = (select auth.uid()));
