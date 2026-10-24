# Star Sign

Project brain docs live in `.agents/` — start with `.agents/index.md`, then read
`company.md`, `product.md`, and `engineering.md` before any implementation work.
API conventions in `.agents/api.md` govern every route handler (implementations
in `apps/web/app/api/`, helpers in `apps/web/app/api/_lib/api.ts`); current-state
facts in `.agents/architecture.md` with the proposed persistence model in
`.agents/data-model.md`. Design system in `.agents/design-system.md` (v2 draft
in `.agents/design-system-v2-draft.md` is NOT accepted). Shipping rules in
`.agents/workflows.md`; Linear facts in `.agents/linear.md`. Design reference
screenshots in `design/reference/`. Canonical long-form source lives in Notion
("Costar : Product Notes"); keep both in sync when decisions change.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. Route only to skills in the session's available-skills list; answer directly for quick questions or small scoped edits.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
