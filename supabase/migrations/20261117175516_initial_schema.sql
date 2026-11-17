-- Andmebaasi skeem: kodud, liikmed, tööd ja seadmete sidumine koduga (#2).
-- Piirangud vastavad failile src/lib/household.ts:
--   nimi ≤ 24 märki, töö nimi ≤ 40 märki, kodus 2–6 liiget,
--   nimed ja tööd on kodu sees unikaalsed tõstutundetult.
-- RLS on kõigil tabelitel sees, aga reegleid veel pole (#3), seega
-- anon/authenticated rollid ei näe esialgu midagi.

-- Kutsekood: 8 märki ilma kergesti segiaetavate tähtedeta (0/O, 1/I/L).
create function public.generate_invite_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(
    substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1),
    ''
  )
  from generate_series(1, 8);
$$;

create table public.households (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique default public.generate_invite_code()
    check (invite_code ~ '^[A-Z0-9]{6,16}$'),
  created_at timestamptz not null default now()
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null
    check (name = btrim(name) and char_length(name) between 1 and 24),
  -- Järjekord. Liikme värv tuleb tema kohast selles järjekorras.
  position int not null check (position between 0 and 5),
  created_at timestamptz not null default now(),
  -- Ümberjärjestamine ühes transaktsioonis on lubatud.
  unique (household_id, position) deferrable initially deferred,
  -- Vajalik, et tööd saaksid viidata ainult oma kodu liikmetele.
  unique (household_id, id)
);

create unique index members_household_name_key
  on public.members (household_id, lower(name));

create table public.chores (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null
    check (name = btrim(name) and char_length(name) between 1 and 40),
  current_member_id uuid not null,
  last_member_id uuid,
  last_done_at timestamptz,
  created_at timestamptz not null default now(),
  -- Kas mõlemad või kumbki: "viimati tegi X, millal".
  check ((last_member_id is null) = (last_done_at is null)),
  foreign key (household_id, current_member_id)
    references public.members (household_id, id),
  foreign key (household_id, last_member_id)
    references public.members (household_id, id)
    on delete set null (last_member_id)
);

create unique index chores_household_name_key
  on public.chores (household_id, lower(name));
create index chores_current_member_idx
  on public.chores (household_id, current_member_id);
create index chores_last_member_idx
  on public.chores (household_id, last_member_id);

-- Seob seadme (Supabase'i kasutaja, ka anonüümse) koduga. Liige ≠ seade:
-- üks telefon võib olla kahe inimese oma ja üks inimene võib kasutada mitut.
create table public.household_users (
  user_id uuid not null references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, household_id)
);

create index household_users_household_idx
  on public.household_users (household_id);

-- 2–6 liiget kodus. Kontrollitakse transaktsiooni lõpus, et kodu ja selle
-- liikmed saaks luua ühes transaktsioonis.
create function public.check_household_member_count()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target uuid;
  member_count int;
begin
  if tg_table_name = 'households' then
    target := new.id;
  elsif tg_op = 'DELETE' then
    target := old.household_id;
  else
    target := new.household_id;
  end if;

  -- Kustutatud kodu (cascade) ei vaja kontrolli.
  if not exists (select 1 from public.households where id = target) then
    return null;
  end if;

  select count(*) into member_count from public.members where household_id = target;
  if member_count not between 2 and 6 then
    raise exception 'Kodus peab olema 2–6 liiget, praegu on %', member_count
      using errcode = 'check_violation';
  end if;
  return null;
end;
$$;

create constraint trigger households_member_count
  after insert on public.households
  deferrable initially deferred
  for each row execute function public.check_household_member_count();

create constraint trigger members_member_count
  after insert or delete or update of household_id on public.members
  deferrable initially deferred
  for each row execute function public.check_household_member_count();

alter table public.households enable row level security;
alter table public.members enable row level security;
alter table public.chores enable row level security;
alter table public.household_users enable row level security;
