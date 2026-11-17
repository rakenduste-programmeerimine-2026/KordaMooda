-- Tööde pehme kustutamine (#10).
--
-- Töö eemaldamine paneb chores.removed_at kirja, rida ise jääb alles. Nii saab
-- "Võta tagasi" (restore_chore) töö tagasi panna koos ajaloo ("viimati tegi") ja
-- kohaga nimekirjas (created_at ei muutu). Otsus PR #31 ülevaatusest.
--
-- remove_chore(chore_id)   eemaldab töö, juba eemaldatud töö korral ei tee midagi
-- restore_chore(chore_id)  'ok', 'conflict' (pole eemaldatud) või 'duplicate'
--                          (sama nimega töö on vahepeal uuesti lisatud)
--
-- Muud muudatused:
-- - Eemaldatud tööd ei ole kliendile nähtavad ega muudetavad (RLS).
-- - Nimi peab olema unikaalne ainult aktiivsete tööde seas.
-- - Otse kustutada ei saa (delete õigus ära), ainult remove_chore kaudu. Realtime
--   ei rakenda RLS-i DELETE sündmustele, UPDATE sündmustele rakendab.
-- - insert ilma id-ta: tagasivõtmine ei vaja seda enam (PR #31 kommentaar).
-- - mark_done ja undo_done käsitlevad eemaldatud tööd nagu olematut.
-- - Üle päeva tagasi eemaldatud tööd kustutatakse päriselt, kui samas kodus
--   järgmine töö eemaldatakse.

alter table public.chores add column removed_at timestamptz;

drop index public.chores_household_name_key;
create unique index chores_household_name_key
  on public.chores (household_id, lower(name))
  where removed_at is null;

-- Õigused
revoke delete on public.chores from authenticated;
revoke insert on public.chores from authenticated;
grant insert (household_id, name, current_member_id) on public.chores to authenticated;

drop policy "Liige eemaldab oma kodu töid" on public.chores;

drop policy "Liige näeb oma kodu töid" on public.chores;
create policy "Liige näeb oma kodu töid"
  on public.chores for select
  to authenticated
  using (removed_at is null and (select private.is_household_member(household_id)));

drop policy "Liige muudab oma kodu töid" on public.chores;
create policy "Liige muudab oma kodu töid"
  on public.chores for update
  to authenticated
  using (removed_at is null and (select private.is_household_member(household_id)))
  with check ((select private.is_household_member(household_id)));

-- Kodu, kuhu töö kuulub, kui kutsuja on selle kodu liige. Muidu viga, sama mis
-- olematu töö korral, et ei reedaks, kas töö on olemas.
create function private.chore_household(target_chore uuid, include_removed boolean)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  select c.household_id into target
  from public.chores c
  where c.id = target_chore and (include_removed or c.removed_at is null);

  if target is null or not private.is_household_member(target) then
    raise exception 'Seda tööd pole olemas.' using errcode = 'P0002';
  end if;
  return target;
end;
$$;

revoke all on function private.chore_household(uuid, boolean) from public;

create function public.remove_chore(chore_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := private.chore_household(chore_id, true);
begin
  delete from public.chores c
  where c.household_id = target and c.removed_at < now() - interval '1 day';

  update public.chores c
  set removed_at = now()
  where c.id = chore_id and c.removed_at is null;

  return 'ok';
end;
$$;

create function public.restore_chore(chore_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.chore_household(chore_id, true);

  update public.chores c
  set removed_at = null
  where c.id = chore_id and c.removed_at is not null;

  if not found then
    return 'conflict';
  end if;
  return 'ok';
exception
  when unique_violation then
    return 'duplicate';
end;
$$;

-- mark_done ja undo_done nagu 20261117181454_mark_done.sql, aga eemaldatud
-- töö on nagu olematu.
create or replace function public.mark_done(chore_id uuid, expected_member_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_household uuid := private.chore_household(chore_id, false);
  expected_position int;
  next_member uuid;
begin
  select m.position into expected_position
  from public.members m
  where m.id = expected_member_id and m.household_id = target_household;

  -- Järgmine järjekorras, viimase järel jälle esimene.
  select m.id into next_member
  from public.members m
  where m.household_id = target_household and m.position > expected_position
  order by m.position
  limit 1;

  if next_member is null then
    select m.id into next_member
    from public.members m
    where m.household_id = target_household
    order by m.position
    limit 1;
  end if;

  update public.chores c
  set prev_last_member_id = c.last_member_id,
      prev_last_done_at = c.last_done_at,
      last_member_id = expected_member_id,
      last_done_at = now(),
      last_done_by = (select auth.uid()),
      current_member_id = next_member
  where c.id = chore_id
    and c.removed_at is null
    and c.current_member_id = expected_member_id;

  if not found then
    return 'conflict';
  end if;
  return 'ok';
end;
$$;

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
    and c.last_done_by = (select auth.uid());

  if not found then
    return 'conflict';
  end if;
  return 'ok';
end;
$$;

revoke all on function public.remove_chore(uuid) from public, anon;
revoke all on function public.restore_chore(uuid) from public, anon;
grant execute on function public.remove_chore(uuid) to authenticated;
grant execute on function public.restore_chore(uuid) to authenticated;
