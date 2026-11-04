-- 0015: the daily-updates grant (W2 friend updates).
--
-- friend updates show a connected person's daily theme only when THAT
-- person granted it. share_scope (0010) is trigger-frozen at acceptance
-- and its accepted rows must never silently widen — so the grant is two
-- new boolean columns, one per party, defaulting false:
--
--   daily_updates_requester  — the requester shares their daily updates
--                              with the addressee
--   daily_updates_addressee  — the addressee shares theirs with the
--                              requester
--
-- Lifecycle (guard below): grants begin false at insert; the
-- requested→accepted transition records the product default both ways
-- ("share daily updates ON", symmetric with the chart-placements grant);
-- after acceptance each party may flip ONLY their own column, per
-- request, session-bound (app.actor_profile_id(), the 0013 helper —
-- service-role flips are rejected like service-role transitions).
-- Revocation/disconnection ends sharing entirely through the existing
-- state machine; the friend-updates route rechecks state + grant on
-- every read.
--
-- Rollback: DROP TRIGGER connections_guard_daily_updates ON
--   public.connections; DROP FUNCTION
--   public.connections_guard_daily_updates(); ALTER TABLE
--   public.connections DROP COLUMN daily_updates_requester, DROP COLUMN
--   daily_updates_addressee;

begin;

alter table public.connections
  add column daily_updates_requester boolean not null default false,
  add column daily_updates_addressee boolean not null default false;

create function public.connections_guard_daily_updates() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.daily_updates_requester or new.daily_updates_addressee then
      raise exception 'daily-update grants start off; they are recorded at acceptance';
    end if;
    return new;
  end if;

  -- Acceptance records the product default both ways. Only the recipient
  -- can perform this transition (connections_guard_transition); either
  -- party can narrow their own grant afterwards.
  if old.state = 'requested' and new.state = 'accepted' then
    new.daily_updates_requester := true;
    new.daily_updates_addressee := true;
    return new;
  end if;

  -- Grants may not be introduced on a non-accepted row (no consent yet).
  -- Only a CHANGE is intercepted: an unchanged-grant update that moves
  -- state illegally (accepted -> requested) falls through so the 0006
  -- transition trigger raises its own error — each guard owns one
  -- concern, and BEFORE triggers fire alphabetically (this one first).
  if new.state <> 'accepted'
     and (new.daily_updates_requester <> old.daily_updates_requester
       or new.daily_updates_addressee <> old.daily_updates_addressee) then
    raise exception 'daily-update grants apply only to accepted connections';
  end if;

  -- Accepted or terminal rows: a changed grant must be flipped by its
  -- owner (consent acts are session-bound; null actor = service role).
  if new.daily_updates_requester <> old.daily_updates_requester then
    if app.actor_profile_id() is null or app.actor_profile_id() <> new.requester_id then
      raise exception 'only the requester can change their daily-updates grant';
    end if;
  end if;
  if new.daily_updates_addressee <> old.daily_updates_addressee then
    if app.actor_profile_id() is null or app.actor_profile_id() <> new.addressee_id then
      raise exception 'only the addressee can change their daily-updates grant';
    end if;
  end if;
  return new;
end;
$$;

create trigger connections_guard_daily_updates
  before insert or update on public.connections
  for each row execute function public.connections_guard_daily_updates();

commit;
