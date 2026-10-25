-- 0006: connections — the two-person consent state machine (ASH-256 / 5.1a).
--
-- States: requested → accepted (recipient-only); revoked (either party,
-- from any non-terminal state); disconnected (terminal). Every transition
-- explicit (enforced in route handlers + rechecked in triggers below);
-- RLS fail-closed: participants SELECT their own rows only. This table
-- grants NO cross-user chart data access — chart visibility (5.2) keys
-- off an accepted row here but reads nothing through it.
--
-- Rollback: DROP TABLE public.connection_state_log; DROP TABLE public.connections;

create table public.connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  state text not null check (state in ('requested', 'accepted', 'revoked', 'disconnected')),
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  ended_at timestamptz,
  updated_at timestamptz not null default now(),
  check (requester_id <> addressee_id)
);

-- One active connection per pair, either direction. Ended rows
-- (revoked/disconnected) stay for audit; a fresh request makes a new row.
create unique index connections_active_pair_idx
  on public.connections (
    least(requester_id, addressee_id),
    greatest(requester_id, addressee_id)
  )
  where state in ('requested', 'accepted');

-- FK-supporting indexes (migration discipline: every FK gets one).
create index connections_requester_idx on public.connections (requester_id);
create index connections_addressee_idx on public.connections (addressee_id);

alter table public.connections enable row level security;

-- Both participants can SELECT their own connection rows (any state) —
-- they need them to see their pending requests and ended history.
create policy "participants read own connections" on public.connections
  for select to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- Only the requester can INSERT a new connection (as 'requested').
create policy "requester inserts connection" on public.connections
  for insert to authenticated
  with check (auth.uid() = requester_id and state = 'requested');

-- Updates: participants, and only through the state-transition guard
-- (trigger below); WITH CHECK re-asserts both parties stay the parties.
create policy "participants update own connections" on public.connections
  for update to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id)
  with check (auth.uid() = requester_id or auth.uid() = addressee_id);

-- No DELETE policy: rows are never deleted (terminal states + audit);
-- anon has no grants and no policies at all — fail closed.

-- Explicit state machine: the ONLY legal transitions. Anything else
-- raises — the table, not the handler, is the enforcement point.
create function public.connections_guard_transition() returns trigger
language plpgsql as $$
begin
  if new.requester_id <> old.requester_id or new.addressee_id <> old.addressee_id then
    raise exception 'connection parties are immutable';
  end if;

  if old.state = 'requested' then
    if new.state = 'accepted' then
      -- ONLY the recipient can accept: the requester self-accepting
      -- would bypass recipient consent entirely.
      if auth.uid() is null or auth.uid() <> new.addressee_id then
        raise exception 'only the recipient can accept a connection';
      end if;
    elsif new.state = 'revoked' then
      -- Withdraw (requester) or decline (addressee): either participant.
      if auth.uid() is null or auth.uid() not in (old.requester_id, old.addressee_id) then
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
    if auth.uid() is null or auth.uid() not in (old.requester_id, old.addressee_id) then
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

create trigger connections_transition_guard
  before update on public.connections
  for each row execute function public.connections_guard_transition();

-- Audit trail of every transition (who, what, when) — supports the
-- deletion interplay (0.1c) and dispute debugging without guessing.
create table public.connection_state_log (
  id bigint generated always as identity primary key,
  connection_id uuid not null references public.connections(id) on delete cascade,
  actor_id uuid not null,
  from_state text not null,
  to_state text not null,
  at timestamptz not null default now()
);

alter table public.connection_state_log enable row level security;

create policy "participants read own connection log" on public.connection_state_log
  for select to authenticated
  using (
    exists (
      select 1 from public.connections c
      where c.id = connection_id
        and (auth.uid() = c.requester_id or auth.uid() = c.addressee_id)
    )
  );

create index connection_state_log_connection_idx
  on public.connection_state_log (connection_id);

-- Log writes happen through the state-bump trigger below; participants
-- get no direct INSERT grant path in policy terms (insert policy absent
-- = fail closed; the trigger runs as the table owner via security
-- definer so legitimate transitions can still log).
create function public.connections_log_transition() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.state <> old.state then
    insert into public.connection_state_log (connection_id, actor_id, from_state, to_state)
    values (new.id, coalesce(auth.uid(), new.requester_id), old.state, new.state);
  end if;
  return new;
end;
$$;

create trigger connections_transition_log
  before update on public.connections
  for each row execute function public.connections_log_transition();
