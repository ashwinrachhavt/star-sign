-- 0014: handles — the public, exact-match social identifier (W2).
--
-- The add-by-handle loop needs a stable, human-typable name per profile.
-- Design constraints (spec W2 / FR-06): public, unique, auto-generated
-- ("maya-orion"), editable, exact-match only — there is deliberately no
-- search directory. Lookup happens server-side by exact match (service
-- role); nothing about this column widens RLS.
--
-- Generation covers every creation path uniformly: Clerk provisioning
-- creates profiles through the auth.users signup trigger too (bridge.ts
-- provisionClerkProfileViaSql), so a BEFORE INSERT trigger here catches
-- Supabase signups, Clerk first sign-ins, and test-harness seeds alike.
-- Existing rows are backfilled by the same slug logic.
--
-- Rollback: DROP TRIGGER profiles_assign_handle ON public.profiles;
--   DROP FUNCTION public.slugify_handle(text); DROP FUNCTION
--   public.profiles_assign_handle(); ALTER TABLE public.profiles
--   DROP COLUMN handle;

begin;

alter table public.profiles
  add column handle text
    constraint profiles_handle_format_check
    check (handle ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' and char_length(handle) between 2 and 40);

alter table public.profiles
  add constraint profiles_handle_key unique (handle);

-- Lowercase alphanumerics and single dashes. Star Sign's own writing;
-- the auto-generated shape reads like a name, not an id.
create function public.slugify_handle(raw text) returns text
language sql immutable as $$
  select case
    when char_length(slug) = 0 then 'star'
    when char_length(slug) = 1 then slug || '-star'  -- format check floor is 2 chars
    else left(slug, 36)
  end
  from (
    select trim(both '-' from regexp_replace(lower(coalesce(raw, '')), '[^a-z0-9]+', '-', 'g')) as slug
  ) s
$$;

-- Assign a unique handle when none was provided: display-name slug first,
-- numeric -N suffix on collision. Deterministic given the same profiles
-- table state; the unique constraint is the final backstop.
create function public.profiles_assign_handle() returns trigger
language plpgsql as $$
declare
  base text;
  candidate text;
  n integer := 1;
begin
  if new.handle is null then
    base := public.slugify_handle(new.display_name);
    candidate := base;
    while exists (select 1 from public.profiles p where p.handle = candidate) loop
      n := n + 1;
      candidate := base || '-' || n::text;
    end loop;
    new.handle := candidate;
  end if;
  return new;
end;
$$;

create trigger profiles_assign_handle
  before insert on public.profiles
  for each row execute function public.profiles_assign_handle();

-- Backfill existing profiles (oldest first keeps early members on the
-- unsuffixed slug). The INSERT trigger does not fire on UPDATE; the same
-- collision walk lives inline here.
do $$
declare
  p record;
  base text;
  candidate text;
  n integer;
begin
  for p in select id, display_name from public.profiles where handle is null order by created_at, id
  loop
    base := public.slugify_handle(p.display_name);
    candidate := base;
    n := 1;
    while exists (select 1 from public.profiles x where x.handle = candidate) loop
      n := n + 1;
      candidate := base || '-' || n::text;
    end loop;
    update public.profiles set handle = candidate where id = p.id;
  end loop;
end;
$$;

commit;
