-- Our Sky initial schema
-- Ownership boundary: RLS on every user-owned table.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'friend',
  created_at timestamptz not null default now()
);

create table public.birth_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  birth_date date not null,
  birth_time time,
  birth_time_precision text not null check (birth_time_precision in ('exact', 'approximate', 'unknown')),
  birth_time_zone text not null,
  birth_lat double precision not null,
  birth_lon double precision not null,
  birth_place_label text,
  updated_at timestamptz not null default now()
);

create table public.daily_readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  for_date date not null,
  headline text not null,
  explanation text not null,
  dos jsonb not null,
  donts jsonb not null,
  life_areas jsonb not null,
  provenance jsonb not null,
  uncertainty_note text not null,
  created_at timestamptz not null default now(),
  unique (user_id, for_date)
);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null,
  -- Nullable: a person may have no known birth data
  birth_date date,
  birth_time time,
  birth_time_precision text not null default 'unknown' check (birth_time_precision in ('exact', 'approximate', 'unknown')),
  birth_time_zone text,
  birth_lat double precision,
  birth_lon double precision,
  relation text not null default 'friend',
  created_at timestamptz not null default now()
);

create table public.compatibility_reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  dimensions jsonb not null,
  provenance jsonb not null,
  created_at timestamptz not null default now()
);

create table public.reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  for_date date not null,
  body text not null,
  created_at timestamptz not null default now(),
  unique (user_id, for_date)
);

-- Row Level Security: the ownership boundary
alter table public.profiles enable row level security;
alter table public.birth_profiles enable row level security;
alter table public.daily_readings enable row level security;
alter table public.people enable row level security;
alter table public.compatibility_reports enable row level security;
alter table public.reflections enable row level security;

create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "own birth profile" on public.birth_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own readings" on public.daily_readings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own people" on public.people
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "own compatibility reports" on public.compatibility_reports
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "own reflections" on public.reflections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', 'friend'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
