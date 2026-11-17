-- Aatomiline "Tehtud" ja selle tagasivõtmine (#4).
--
-- mark_done(chore_id, expected_member_id)
--   Liigutab järjekorra järgmisele liikmele (position järgi, ringiga), nagu
--   nextMember/markDone failis src/lib/household.ts. Kui järjekord on vahepeal
--   liikunud (current_member_id <> expected_member_id), ei muuda midagi ja
--   tagastab 'conflict'. Kontroll ja muudatus on üks UPDATE, seega kahest
--   samaaegsest kutsest õnnestub täpselt üks.
--
-- undo_done(chore_id)
--   Taastab seisu enne viimast "Tehtud"-t, kui selle vajutas sama kasutaja ja
--   keegi pole vahepeal uuesti vajutanud. Muidu tagastab 'conflict'.
--
-- Mõlemad tagastavad 'ok' või 'conflict'. Kui tööd pole või see on võõras
-- kodus, tuleb viga 'Seda tööd pole olemas.' (ei reeda, kas töö on olemas).
--
-- Funktsioonid on security definer ja kontrollivad liikmesust ise. Järjekorra
-- veerge ei saa enam otse muuta, et keegi ei saaks järjekorda vahele jätta.

alter table public.chores
  add column prev_last_member_id uuid,
  add column prev_last_done_at timestamptz,
  -- Seade, kes vajutas viimati "Tehtud". Ainult tagasivõtmiseks.
  add column last_done_by uuid references auth.users (id) on delete set null,
  add foreign key (household_id, prev_last_member_id)
    references public.members (household_id, id)
    on delete set null (prev_last_member_id);

create index chores_prev_last_member_idx
  on public.chores (household_id, prev_last_member_id);
create index chores_last_done_by_idx
  on public.chores (last_done_by);

-- Järjekorda muudavad ainult allolevad funktsioonid.
revoke update on public.chores from authenticated;
grant update (name) on public.chores to authenticated;

create function public.mark_done(chore_id uuid, expected_member_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_household uuid;
  expected_position int;
  next_member uuid;
begin
  select c.household_id into target_household
  from public.chores c
  where c.id = chore_id;

  if target_household is null or not private.is_household_member(target_household) then
    raise exception 'Seda tööd pole olemas.' using errcode = 'P0002';
  end if;

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
    and c.current_member_id = expected_member_id;

  if not found then
    return 'conflict';
  end if;
  return 'ok';
end;
$$;

create function public.undo_done(chore_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_household uuid;
begin
  select c.household_id into target_household
  from public.chores c
  where c.id = chore_id;

  if target_household is null or not private.is_household_member(target_household) then
    raise exception 'Seda tööd pole olemas.' using errcode = 'P0002';
  end if;

  update public.chores c
  set current_member_id = c.last_member_id,
      last_member_id = c.prev_last_member_id,
      last_done_at = c.prev_last_done_at,
      prev_last_member_id = null,
      prev_last_done_at = null,
      last_done_by = null
  where c.id = chore_id
    and c.last_member_id is not null
    and c.last_done_by = (select auth.uid());

  if not found then
    return 'conflict';
  end if;
  return 'ok';
end;
$$;

revoke all on function public.mark_done(uuid, uuid) from public, anon;
revoke all on function public.undo_done(uuid) from public, anon;
grant execute on function public.mark_done(uuid, uuid) to authenticated;
grant execute on function public.undo_done(uuid) to authenticated;
