# Auth setup — Clerk + Supabase (ASH-231)

What is wired in code vs. what Ashwin must click/configure. Nothing here
requires code changes; every manual step is dashboard-side.

## Already in code (this PR)

- `@clerk/nextjs@6.39.8` (exact pin) in `apps/web`
- `ClerkProvider` in `app/layout.tsx` (no-op passthrough without env keys)
- Login page: Google + Apple OAuth buttons + email/password (Clerk path
  when configured; Supabase fallback when not — no lockout)
- `/sso-callback` route completing the OAuth redirect
- `lib/auth/bridge.ts`: Clerk subject → `profiles.clerk_subject` →
  profile UUID; `requireActor` swap (call sites unchanged)
- `middleware.ts`: protection keys off Clerk when configured
- `POST /api/account-export`, `POST /api/account-deletion` (SQL cascade +
  Clerk `users.deleteUser`)
- Migration `0009_clerk_identity_bridge.sql`: `profiles.clerk_subject
  text unique`, `auth_provider` column
- Migration `0013_rls_v3_clerk_subject.sql` (RLS v3, W1): every
  actor-owned table's RLS resolves the actor through
  `profiles.clerk_subject` via `app.actor_profile_id()` — the web
  Supabase client passes the Clerk session token through the
  `accessToken` callback, so no JWT template is needed. Legacy
  Supabase-auth sessions (sub = profile UUID, no clerk_subject) keep
  resolving — the fallback path never locks out.
- Provisioning (`lib/auth/sql-admin.ts` `provisionClerkProfileViaSql`):
  first Clerk sign-in anchors an `auth.users` row through the SQL
  identity channel (third-party auth never creates one, and
  `profiles.id` FKs it), then maps the subject with
  `auth_provider='clerk'`
- RLS bridge tests: `packages/db/src/clerk-bridge.test.ts` +
  `packages/db/src/rls-v3.test.ts`

## Ashwin's checklist (dashboard only)

### 1. Env vars (Vercel + local `.env.local` — never commit)

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...   # Clerk dashboard → API keys
CLERK_SECRET_KEY=sk_...                    # server-only
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
CLERK_WEBHOOK_SECRET=whsec_...             # if syncing user events later
```

Clerk app: use the existing `app_3LA5yQmjnBph7r0ZKBPZ2uhpuP1`.

### 2. OAuth providers (Clerk dashboard → SSO connections)

- Google: create OAuth credentials in Google Cloud Console → OAuth client
  (web), authorized redirect URI = `https://<clerk-domain>.clerk.accounts.dev/v1/oauth_callback`
  (exact URL shown in the Clerk connection page). Paste client ID/secret
  into Clerk.
- Apple: requires an Apple Developer account ($99/yr) → Services ID +
  Sign in with Apple key; same paste-into-Clerk step.
- Both buttons render in the UI already; they activate the moment the
  connections are enabled in Clerk.

### 3. Supabase third-party auth (Supabase dashboard → Authentication → Third-Party Auth)

- Add Clerk as issuer with domain `https://<clerk-domain>.clerk.accounts.dev`
- Supabase then validates Clerk JWTs; the request's JWT `sub` claim IS
  the raw Clerk subject, and RLS v3 (migration 0013) resolves ownership
  through `profiles.clerk_subject` from that subject.

### 4. No JWT template (fork resolved — RLS v3)

None needed. The earlier plan (and the 0009-header ruling) expected a
Clerk JWT template to carry the **profile UUID** in `sub`; that path is
not implementable as written — Clerk JWT templates are static claims and
cannot perform a per-user DB lookup. The fork is resolved by re-keying
RLS instead: migration `0013_rls_v3_clerk_subject.sql` resolves every
actor-owned table through `profiles.clerk_subject`, and the native
integration passes the Clerk `sub` through unchanged.

Migration numbering note: the spec expected `0011` to be free, but main
gained `0011_onboarding_and_places.sql` (#42) and `0012` is reserved by
the incoming life-area-temperatures merge — RLS v3 took the next free
number, `0013`.

### 5. Session revocation (0.1d — configuration only)

- Clerk dashboard → Sessions: set session lifetime/rotation policy.
  "Sign out everywhere" = revoke all sessions per user — available in
  the Clerk dashboard (Users → user → Revoke sessions) and via
  `users.revokeSession`/`revokeSessions` backend API (the sign-out route
  already revokes the current session server-side).
- No custom code required (ticket criterion 6).

### 6. Migrating existing email+password users

Current Supabase Auth users keep working through the fallback path
(`clerkConfigured() === false` for them is not possible once env keys
land — the fallback keys off env, not per-user). To bring existing
users into Clerk: Clerk dashboard → Users → import, or have users
"Continue with Google/Apple" then link by email (Clerk merges on verified
email automatically). Password users can also use Clerk's email+password
directly; `profiles.clerk_subject` backfills on their first Clerk login
via `resolveActor` provisioning — matched by email if you pre-import.

## Local development without Clerk keys

Everything works as before ASH-231: Supabase password auth, local e2e,
db tests. The Clerk path activates only when both env keys are present.

## Local development with Clerk keys

Three things must be true or the app silently falls back / loop-redirects:

1. `apps/web/.env.local` has both `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and
   `CLERK_SECRET_KEY`. `login/page.tsx` and `middleware.ts` key off them.
2. `apps/web/.env.local` gives provisioning a database URL, as either
   `SUPABASE_DB_URL` or `SUPABASE_DB_PASSWORD`. The first Clerk sign-in
   must anchor an `auth.users` row through `lib/auth/sql-admin.ts`, which
   needs a direct Postgres connection; without one `resolveActor` returns
   null, so every protected page bounces to `/login` while `/login`
   bounces back for a signed-in user — an `ERR_TOO_MANY_REDIRECTS` loop.
   Locally: `SUPABASE_DB_URL=postgres://postgres:postgres@localhost:54322/postgres`.
3. `supabase/config.toml` enables Clerk as a third-party issuer, so the
   local PostgREST accepts Clerk JWTs (RLS v3 resolves the subject):

   ```toml
   [auth.third_party.clerk]
   enabled = true
   domain = "<instance>.clerk.accounts.dev"
   ```

   The domain is the part of the publishable key: base64-decode the text
   after `pk_test_` and drop the trailing `$`. After changing it, run
   `supabase stop && supabase start` (config is applied at container
   start; `supabase status` keeps working either way).

Restart `next dev` after adding env keys — `NEXT_PUBLIC_*` values are
inlined at start, so hot reload will not pick them up.

`middleware.ts` wraps `clerkMiddleware()` only when Clerk is configured;
the Supabase session path stays untouched for local/CI runs. Server pages
resolve the actor through `lib/auth/bridge.ts` (`resolveActor`) rather
than `supabase.auth.getUser()`, which returns null for Clerk sessions.
