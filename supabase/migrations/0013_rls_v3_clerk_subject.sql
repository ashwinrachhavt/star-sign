-- 0013: RLS v3 — actor ownership re-keyed to the Clerk subject (W1).
--
-- Supersedes the 0009-header ruling that a Clerk JWT template would carry
-- the profile UUID in `sub`: Clerk JWT templates are static claims — they
-- cannot perform a per-user DB lookup, so `sub` cannot carry the mapped
-- profile UUID. With the native Clerk↔Supabase third-party integration
-- the Clerk session token is passed through unchanged, and
-- auth.jwt()->>'sub' IS the Clerk subject. Every actor-owned table
-- therefore resolves ownership through profiles.clerk_subject — one
-- policy generation, no template, no user-metadata coupling.
--
-- Legacy fallback stays green: Supabase-auth sessions (local dev, tests,
-- e2e, pre-Clerk accounts) carry sub = the profile UUID text and no
-- clerk_subject. The helpers below resolve both shapes; they cannot
-- collide (Clerk subjects are 'user_*' text, and the legacy id match
-- requires clerk_subject to be null).
--
-- Rollback: drop function app.actor_profile_id(); drop function
--   app.actor_subject(); drop schema app; recreate the pre-v3 policies
--   and the 0007 trigger functions verbatim from 0001/0007/0008/0011.

begin;

create schema if not exists app;
grant usage on schema app to authenticated, anon, service_role;

-- The raw JWT sub claim: the Clerk subject ('user_…') for Clerk sessions,
-- or the profile UUID text for legacy Supabase-auth sessions. Supabase's
-- own auth.jwt() reads request.jwt.claims; '' normalizes to null.
create or replace function app.actor_subject() returns text
language sql stable security definer set search_path = app, public as $$
  select nullif(auth.jwt() ->> 'sub', '')
$$;

-- The profile owning the current request: by clerk_subject (Clerk
-- sessions) or, when unmapped, by id = sub (legacy Supabase sessions).
-- SECURITY DEFINER so every policy shares one resolution path and the
-- lookup happens outside the querying table's own RLS.
create or replace function app.actor_profile_id() returns uuid
language sql stable security definer set search_path = app, public as $$
  select p.id from public.profiles p
  where p.clerk_subject = app.actor_subject()
     or (p.clerk_subject is null and p.id::text = app.actor_subject())
  limit 1
$$;

grant execute on function app.actor_subject(), app.actor_profile_id()
  to authenticated, anon, service_role;

-- ---------------------------------------------------------------------------
-- 0001 tables: ownership via the resolved profile (subject → profile UUID).
-- ---------------------------------------------------------------------------

drop policy if exists "own birth profile" on public.birth_profiles;
create policy "own birth profile" on public.birth_profiles
  for all to authenticated
  using (user_id = app.actor_profile_id())
  with check (user_id = app.actor_profile_id());

drop policy if exists "own readings" on public.daily_readings;
create policy "own readings" on public.daily_readings
  for all to authenticated
  using (user_id = app.actor_profile_id())
  with check (user_id = app.actor_profile_id());

drop policy if exists "own people" on public.people;
create policy "own people" on public.people
  for all to authenticated
  using (owner_id = app.actor_profile_id())
  with check (owner_id = app.actor_profile_id());

drop policy if exists "own compatibility reports" on public.compatibility_reports;
create policy "own compatibility reports" on public.compatibility_reports
  for all to authenticated
  using (owner_id = app.actor_profile_id())
  with check (owner_id = app.actor_profile_id());

drop policy if exists "own reflections" on public.reflections;
create policy "own reflections" on public.reflections
  for all to authenticated
  using (user_id = app.actor_profile_id())
  with check (user_id = app.actor_profile_id());

-- profiles is its own resolution table: match the row's identity claims
-- directly (a with-check on insert/update cannot resolve through the row
-- being written). Same two shapes as the helper: mapped subject, or an
-- unmapped legacy row whose id IS the sub.
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all to authenticated
  using (clerk_subject = app.actor_subject()
         or (clerk_subject is null and id::text = app.actor_subject()))
  with check (clerk_subject = app.actor_subject()
         or (clerk_subject is null and id::text = app.actor_subject()));

-- ---------------------------------------------------------------------------
-- 0007 connections + audit log: participants via the resolved profile. The
-- state-machine triggers below are re-keyed in the same generation —
-- auth.uid() is null under Clerk subs and would reject every transition.
-- ---------------------------------------------------------------------------

drop policy if exists "participants read own connections" on public.connections;
create policy "participants read own connections" on public.connections
  for select to authenticated
  using (app.actor_profile_id() = requester_id or app.actor_profile_id() = addressee_id);

drop policy if exists "requester inserts connection" on public.connections;
create policy "requester inserts connection" on public.connections
  for insert to authenticated
  with check (app.actor_profile_id() = requester_id and state = 'requested');

drop policy if exists "participants update own connections" on public.connections;
create policy "participants update own connections" on public.connections
  for update to authenticated
  using (app.actor_profile_id() = requester_id or app.actor_profile_id() = addressee_id)
  with check (app.actor_profile_id() = requester_id or app.actor_profile_id() = addressee_id);

drop policy if exists "participants read own connection log" on public.connection_state_log;
create policy "participants read own connection log" on public.connection_state_log
  for select to authenticated
  using (
    exists (
      select 1 from public.connections c
      where c.id = connection_id
        and (app.actor_profile_id() = c.requester_id or app.actor_profile_id() = c.addressee_id)
    )
  );

-- 0007 trigger functions, re-keyed: actor identity comes from the helper
-- (Clerk subject or legacy UUID), not from auth.uid().
create or replace function public.connections_guard_transition() returns trigger
language plpgsql as $$
begin
  if new.requester_id <> old.requester_id or new.addressee_id <> old.addressee_id then
    raise exception 'connection parties are immutable';
  end if;

  if old.state = 'requested' then
    if new.state = 'accepted' then
      -- ONLY the recipient can accept: the requester self-accepting
      -- would bypass recipient consent entirely.
      if app.actor_profile_id() is null or app.actor_profile_id() <> new.addressee_id then
        raise exception 'only the recipient can accept a connection';
      end if;
    elsif new.state = 'revoked' then
      -- Withdraw (requester) or decline (addressee): either participant.
      if app.actor_profile_id() is null or app.actor_profile_id() not in (old.requester_id, old.addressee_id) then
        raise exception 'only a participant can revoke a connection';
      end if;
    else
      raise exception 'invalid transition % -> %', old.state, new.state;
    end if;
  elsif old.state = 'accepted' then
    -- Only revocation/disconnection from accepted; either participant.
    if new.state not in ('revoked', 'disconnected') then
      raise exception 'invalid transition % -> %', old.state, new.state;
    end if;
    if app.actor_profile_id() is null or app.actor_profile_id() not in (old.requester_id, old.addressee_id) then
      raise exception 'only a participant can end a connection';
    end if;
  else
    -- revoked/disconnected are terminal.
    raise exception 'invalid transition % -> %', old.state, new.state;
  end if;

  if new.state in ('revoked', 'disconnected') then
    new.ended_at := coalesce(new.ended_at, now());
  end if;
  if new.state <> old.state then
    new.responded_at := coalesce(new.responded_at, now());
    new.updated_at := now();
  end if;
  return new;
end;
$$;

-- Audit actor: the resolved profile of the acting session; falls back to
-- the requester only for service-role/trigger-internal writes.
create or replace function public.connections_log_transition() returns trigger
language plpgsql security definer set search_path = public, app as $$
begin
  if new.state <> old.state then
    insert into public.connection_state_log (connection_id, actor_id, from_state, to_state)
    values (new.id, coalesce(app.actor_profile_id(), new.requester_id), old.state, new.state);
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 0008 / 0011: remaining actor-owned tables.
-- ---------------------------------------------------------------------------

drop policy if exists "own preferences" on public.notification_preferences;
create policy "own preferences" on public.notification_preferences
  for all to authenticated
  using (user_id = app.actor_profile_id())
  with check (user_id = app.actor_profile_id());

drop policy if exists "own onboarding row" on public.onboarding_profiles;
create policy "own onboarding row" on public.onboarding_profiles
  for all to authenticated
  using (user_id = app.actor_profile_id())
  with check (user_id = app.actor_profile_id());

commit;
