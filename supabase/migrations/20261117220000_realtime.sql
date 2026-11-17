-- Reaalajas uuendused teises telefonis (#13).
--
-- Telefon jälgib Supabase Realtime'iga ainult oma kodu rida (households), mitte
-- töid. Iga töö või liikme muutus uuendab households.changed_at, seega tuleb
-- ühe muutuse kohta üks sündmus. Selle peale laeb telefon kodu serverist uuesti
-- (src/lib/useHouseholdRealtime.ts → router.refresh), sündmuse sisu ei kasutata.
--
-- Miks mitte otse chores tabelit:
-- - Realtime kontrollib RLS-i uue rea järgi. Eemaldatud töö (removed_at, #10) pole
--   enam nähtav, nii et eemaldamise sündmus ei jõuaks teise telefoni.
-- - Realtime ei rakenda RLS-i DELETE sündmustele: kõik tellijad näeksid kustutatud
--   ridade id-sid.
-- Oma kodu rida on liikmele alati nähtav ("Liige näeb oma kodu"), seega kehtib RLS
-- ja võõra kodu sündmusi ei saa tellida.

alter table public.households
  add column changed_at timestamptz not null default now();

create function private.touch_household()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.households
  set changed_at = now()
  where id = coalesce(new.household_id, old.household_id);
  return null;
end;
$$;

revoke all on function private.touch_household() from public;

create trigger chores_touch_household
  after insert or update or delete on public.chores
  for each row execute function private.touch_household();

create trigger members_touch_household
  after insert or update or delete on public.members
  for each row execute function private.touch_household();

alter publication supabase_realtime add table public.households;
