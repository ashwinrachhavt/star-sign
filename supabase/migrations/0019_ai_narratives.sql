-- 0019: cache grounded AI narratives (launch wave 1).
--
-- One generated narrative per (user, scope, for_date, variant): the row
-- is the durable cache, mirroring the daily_readings idempotency pattern
-- (unique constraint → race readback). The model is called only on a
-- cache miss, so cost is bounded per user per day per scope.
--
-- variant: "" for day/week scopes; for ask it is the digest of the
-- question, so the same question on the same day is generated once.
--
-- Provenance columns (model_name/model_version/prompt_version/
-- facts_digest) record WHAT produced the text and WHICH supplied engine
-- facts it restates — the narrative layer is contract-bound to those
-- facts (it must refuse, never invent), so the digest is the audit hook.
create table public.ai_narratives (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  scope text not null check (scope in ('daily', 'week', 'ask')),
  for_date date not null,
  variant text not null default '',
  narrative text not null,
  model_name text not null,
  model_version text not null,
  prompt_version text not null,
  facts_digest text not null,
  created_at timestamptz not null default now(),
  unique (user_id, scope, for_date, variant)
);

alter table public.ai_narratives enable row level security;

create policy "own narratives" on public.ai_narratives
  for all to authenticated
  using (user_id = app.actor_profile_id())
  with check (user_id = app.actor_profile_id());

comment on table public.ai_narratives is
  'Cached grounded narratives. Text is contract-checked output that may only restate the engine facts digest-supplied at generation time; refusals and provider failures are never cached.';
