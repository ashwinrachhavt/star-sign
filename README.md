# Star Sign

A private sky shared with someone you care about. An independent,
clean-room astrology and relationship-reflection product — inspired by
publicly observable product mechanics, never copying Co–Star's code,
assets, trademarks, or authored text.

## Product promise

> Give a person something useful in under a minute. Help them understand
> themselves and someone they care about. Never claim certainty where the
> inputs or interpretation are uncertain.

## Architecture

pnpm monorepo (decision ARC-001..006 in
[.agents/product-tech-spec.md](.agents/product-tech-spec.md)):

```
apps/web        Next.js 15 (App Router) — web client
apps/mobile     Expo / React Native — iOS client
packages/core   Shared domain layer: types, chart engine, reading generator,
                compatibility scorer (deterministic, provider-agnostic)
supabase/       Postgres schema + RLS migrations (ownership boundary)
```

```text
Web (Next.js) / Mobile (Expo)
  -> Supabase Auth (identity)
  -> Postgres via RLS (durable truth) — RLS policies are the ownership boundary
  -> packages/core (chart calc, reading generation, provenance)
  -> pg_cron + Edge Functions (scheduled + retryable work, later slices)
```

## Core principles

- **Explainability:** every persisted reading records its inputs and the
  versioned ruleset/copy that produced it (`provenance`).
- **Uncertainty:** birth-time precision (`exact` / `approximate` /
  `unknown`) is stored, enforced by a DB constraint, and surfaced verbatim
  in the UI. Houses and ascendant are never computed for unknown times.
- **Privacy:** RLS on every user-owned table; deletion cascades; no sale of
  birth, relationship, or location data.
- **Idempotency:** daily readings are unique per `(user_id, for_date)`;
  generation is retry-safe by construction (spec §7.3).
- **Deterministic core:** the same birth profile + date + ruleset version
  always produces the same reading. Interpretation lives in versioned copy
  packs; astronomical calculation lives in `packages/core/chart.ts`.

## Setup

### 1. Supabase

Create a project at [supabase.com](https://supabase.com), then:

```sh
supabase link --project-ref <ref>
supabase db push        # applies supabase/migrations/*
```

Or run everything locally with `supabase start` + `supabase db reset`.

### 2. Web

```sh
cp apps/web/.env.example apps/web/.env.local   # fill in Supabase values
pnpm --filter @star-sign/web dev
```

### 3. iOS (Expo)

```sh
cp apps/mobile/.env.example apps/mobile/.env    # fill in Supabase values
pnpm --filter @star-sign/mobile start             # press i for iOS simulator
```

Production iOS builds use [EAS Build](https://docs.expo.dev/build/introduction/):
`eas build -p ios`.

## Development

```sh
pnpm test            # all workspace tests
pnpm typecheck       # all workspaces
pnpm build           # build all
```

The chart engine (`packages/core`) is fully local: no network, no provider.
The core product works when every external provider is down.

## Feature roadmap

Full Co–Star Pro-parity surface (ARC-006), built as ordered vertical slices:

1. **[built]** Auth, birth profile, natal chart, My Day daily reading,
   provenance, people + compatibility reports
2. Life-area deep dives, dive-deeper long-form readings
3. Transit alerts (full moons, retrogrades) via pg_cron + push notifications
4. Daily recommendations (read/watch/listen), lessons
5. Ask Star Sign (bounded Q&A over stored chart + transits)
6. Relationship prompts, shared reflections, rituals
7. Premium boundary (depth as the natural paywall)

## Clean-room charter

Reproduce useful product mechanics from public behavior. Do not copy
Co–Star's code, private APIs, visual assets, trademarks, or authored
horoscope text. All copy in `packages/core/src/reading.ts` is original.
