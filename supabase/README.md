# Supabase setup

## Local development

```sh
supabase start          # local Postgres + Auth + Studio
supabase db reset       # apply migrations
```

## Applying to a hosted project

```sh
supabase link --project-ref <ref>
supabase db push
```

## Environment

Copy `.env.example` in the repo root (or `apps/web`) and fill:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only, never expose to client)

## Design notes

- RLS is the ownership boundary: every user-owned table has policies
  restricting all operations to `auth.uid() = owner`.
- `daily_readings` has a unique constraint on `(user_id, for_date)` so
  generation is idempotent and retry-safe (per spec §7.3).
- Birth data precision is enforced by a check constraint; the schema cannot
  represent a guessed birth time.
- Deleting a user cascades to all their data (export/deletion requirement,
  spec §7.1).
