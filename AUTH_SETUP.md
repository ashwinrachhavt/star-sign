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
- Migration `0007_clerk_identity_bridge.sql`: `profiles.clerk_subject
  text unique`, `auth_provider` column
- RLS bridge tests: `packages/db/src/clerk-bridge.test.ts`

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
- Supabase then validates Clerk JWTs; the signed-in Supabase request's
  `auth.uid()` resolves from the JWT `sub` claim.

### 4. JWT template (Clerk dashboard → JWT templates)

- Create a Supabase template so tokens carry `sub` = the **profile UUID**
  (our bridge value), not the raw Clerk subject. The bridge's
  `resolveActor` supplies the mapping; if the template cannot call out to
  fetch it, set `sub` to the Clerk subject and switch RLS to match on
  `clerk_subject` instead — one policy generation, owner decision needed
  (flagged in the PR).

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
