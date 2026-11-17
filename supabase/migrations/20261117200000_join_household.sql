-- Kutsekood ja koduga liitumine (#9).
--
-- 1. generate_invite_code kasutab nüüd krüptograafiliselt juhuslikke baite
--    (pgcrypto gen_random_bytes). random() väärtusi saab ennustada, kui piisavalt
--    palju koode on nähtud, seega ei sobi see salakoodiks. Kood on endiselt
--    8 märki ilma 0/O ja 1/I/L-ita, nagu src/lib/household.ts createInviteCode.
--
-- 2. join_household(code)
--    Seob kutsuja seadme koduga, mille kutsekood see on. Ainus viis end koju lisada.
--    - Kood normaliseeritakse (suurtähed, ainult tähed ja numbrid), nii et
--      "ab3d-ef7h" ja "AB3D EF7H" töötavad.
--    - Vale kood tagastab null ja jätab katse kirja. Viga ei visata, sest muidu
--      keeraks Postgres ka katse kirjapaneku tagasi.
--    - Kui tunni jooksul on 10 valet katset, tuleb viga KM429. Nii ei saa koodi
--      ära arvata: 31^8 ≈ 8,5e11 võimalust, katseid 10 tunnis kasutaja kohta.
--    - Üks seade on korraga ühes kodus: liitumine eemaldab vana seose.
--
-- 3. new_invite_code()
--    Annab kutsuja kodule uue koodi. Vana kood ja link lakkavad töötamast,
--    juba liitunud seadmed jäävad koju.

create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(8);
  code text := '';
begin
  -- 256 ei jagu 31-ga, aga nihe on liiga väike, et loeks.
  for i in 0..7 loop
    code := code || substr(alphabet, 1 + get_byte(bytes, i) % 31, 1);
  end loop;
  return code;
end;
$$;

revoke execute on function public.generate_invite_code() from public, anon, authenticated;

-- Valed liitumiskatsed. Skeemis private, mida PostgREST välja ei näita.
create table private.join_attempts (
  user_id uuid not null references auth.users (id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index join_attempts_user_time_idx
  on private.join_attempts (user_id, attempted_at);

alter table private.join_attempts enable row level security;
revoke all on private.join_attempts from public, anon, authenticated;

create function public.join_household(code text)
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

  -- Vanad katsed ei loe, koristame need samas ära.
  delete from private.join_attempts where attempted_at < now() - interval '1 day';

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

  return target;
end;
$$;

create function public.new_invite_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  target uuid;
  fresh text;
begin
  select hu.household_id into target
  from public.household_users hu
  where hu.user_id = caller
  order by hu.created_at desc
  limit 1;

  if target is null then
    raise exception 'Sa ei ole veel ühegi koduga liitunud.' using errcode = 'P0002';
  end if;

  update public.households
  set invite_code = public.generate_invite_code()
  where id = target
  returning invite_code into fresh;

  return fresh;
end;
$$;

revoke all on function public.join_household(text) from public, anon;
revoke all on function public.new_invite_code() from public, anon;
grant execute on function public.join_household(text) to authenticated;
grant execute on function public.new_invite_code() to authenticated;
