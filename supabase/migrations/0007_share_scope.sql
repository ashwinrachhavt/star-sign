-- Share scope on connections (ASH-257 / 5.2).
--
-- Criterion 3: the accepted-state share scope is recorded on the row
-- (auditable). v1 scope is fixed: natal chart placements (sign + house)
-- only — no birth data, no readings. The column exists so a future owner
-- decision can widen/narrow it per-connection without a schema change.
--
-- Rollback:
--   alter table public.connections drop column if exists share_scope;

begin;

alter table public.connections
  add column share_scope text not null default 'none'
    check (share_scope in ('none', 'chart_placements'));

-- On acceptance, the recipient's share is recorded explicitly (the scope
-- they agreed to). Backfill: existing accepted rows get the v1 scope.
update public.connections set share_scope = 'chart_placements' where state = 'accepted';

-- Scope is assigned by trigger at acceptance and frozen otherwise: a
-- BEFORE trigger sets 'chart_placements' on the requested→accepted
-- transition and rejects any other share_scope change. Prevents a
-- participant from widening visibility mid-flight.
create or replace function public.connections_guard_share_scope() returns trigger
language plpgsql as $$
begin
  if new.state = 'accepted' and old.state = 'requested' then
    -- Acceptance records the agreed v1 scope.
    new.share_scope := 'chart_placements';
    return new;
  end if;
  if new.share_scope <> old.share_scope then
    raise exception 'share_scope changes only at acceptance';
  end if;
  return new;
end;
$$;

create trigger connections_share_scope_guard
  before update on public.connections
  for each row execute function public.connections_guard_share_scope();

commit;
