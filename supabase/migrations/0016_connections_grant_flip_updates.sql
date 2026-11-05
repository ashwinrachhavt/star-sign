-- 0016: same-state updates on connections (W2 grant flips).
--
-- The 0007 transition guard (as re-keyed to the Clerk subject by 0013)
-- validated the state machine on EVERY row update, so a post-acceptance
-- grant flip (the daily_updates_* columns, migration 0015) — a legal,
-- consent-owned change that never moves the state — was rejected as
-- 'invalid transition accepted -> accepted'. The guard owns TRANSITIONS:
-- validation now runs only when the state actually changes. Party
-- immutability stays unconditional, terminal FROM-states still reject
-- every state change, and grant-column rules stay owned by the 0015
-- guard (grants can only change on accepted rows, by their owner).
-- Actor resolution stays on app.actor_profile_id() (0013): the Clerk
-- subject never reaches uuid casting.
--
-- Rollback: create or replace function
--   public.connections_guard_transition() with the pre-0016 body
--   (verbatim from 0013).

begin;

create or replace function public.connections_guard_transition() returns trigger
language plpgsql as $$
begin
  if new.requester_id <> old.requester_id or new.addressee_id <> old.addressee_id then
    raise exception 'connection parties are immutable';
  end if;

  -- A transition is a state CHANGE. Same-state updates (the 0015 grant
  -- flips) carry no transition to validate.
  if new.state is distinct from old.state then
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

commit;
