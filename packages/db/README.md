# @star-sign/db

Database integration tests: RLS harness and schema-contract tests.

## Running

The harness needs a disposable Postgres with no other data. Default:
Docker on port 54329.

```sh
docker run -d --name starsign-test-pg \
  -e POSTGRES_PASSWORD=postgres -p 54329:5432 postgres:16-alpine

pnpm --dir packages/db test
```

Or point `STAR_SIGN_TEST_DATABASE_URL` at any empty Postgres. The harness
creates `auth`/`public` schema shims (Supabase-compatible `auth.uid()`,
`auth.users`, roles) and applies everything in `supabase/migrations/`.

The database is left dirty after a run; drop and recreate before rerunning
if you need a clean slate:

```sh
docker exec starsign-test-pg psql -U postgres -c \
  "drop schema if exists public cascade; drop schema if exists auth cascade; create schema public;"
```

## What it covers

Full-paranoia RLS depth per `.agents/workflows.md` and ASH-232: per-table
cross-user isolation (select/update/delete), WITH CHECK rejection, anon
zero-rows, service-role separation, deletion-cascade orphan checks,
FK-index coverage, unique-constraint race behavior, updated_at triggers.

Every future user-owned table adds its tests here (EPIC 5 reuses this
harness).
