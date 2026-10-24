# Engineering Log

Append-only record of shipped changes. Format per `.agents/workflows.md`.

## 2026-10-24 — Rename Our Sky → Star Sign + repo baseline (pre-epic housekeeping)

- Change: Renamed packages (@our-sky/* → @star-sign/*), app display names, README, and UI strings to Star Sign; removed superseded agents/ discovery docs; fixed mobile lint script (`expo lint` → `eslint .`) and removed unused imports; seeded ENGINEERING_LOG.md; updated CLAUDE.md to route through `.agents/index.md`.
- Migration: none
- Rollback: revert PR
- Risk: cosmetic naming only; import specifier changes touch all workspace `@our-sky/core` references — CI/typecheck catches a miss. design/reference/ screenshots now gitignored (clean-room: reference material stays local).
- Decisions: `.agents/` brain docs remain untracked (local-only per owner's setup); PR covers rename + tooling, Linear epics untouched.
