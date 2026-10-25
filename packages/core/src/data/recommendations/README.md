# Daily recommendations dataset (ASH-264 / 7.2)

## What this is

A small, curated set of read / watch / listen items tagged by theme
(planet, aspect family, mood). The daily recommendation ruleset
(`packages/core/src/recommendations.ts`) matches the day's transit themes
to these tags. No live scraping, no dynamic catalog — the dataset is
committed, versioned, and reviewable.

## Sourcing and licensing (criterion 3)

- **All items are public-domain works or original Star Sign content.**
  - Books: Project Gutenberg public-domain texts (pre-1929 publications),
    linked to gutenberg.org.
  - Films: pre-1929 public-domain films, linked to Internet Archive.
  - Music: public-domain recordings or performances released under
    Creative Commons CC0/CC-BY, linked to archive.org / musopen.org.
- **No Co–Star assets, text, or API** was used or referenced (clean-room
  rule, `.agents/workflows.md`).
- Descriptions are original writing for Star Sign (voice per
  `.agents/copy.md`).

## Adding items

Tag every item with at least one planet theme and optionally an aspect
family or mood. Never add items whose license status is unclear — when in
doubt, leave it out. Dataset version bumps with content changes
(`DATASET_VERSION` in `recommendations.ts`).
