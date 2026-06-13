# Phase 8 — Full-app convergence (animation roadmap, final package)

Status: blocked on phase 7
Designer/reviewer: Claude · Implementer: Codex
Goal: every remaining surface adopts the same material + motion + chrome system the report now has. After this phase, there is one design language everywhere. This is a visual layer pass — zero functional/behavioral changes.

## Surfaces to converge

### 1. Home — signed-out landing
- Analyze form (username/league-id inputs, Find Leagues / Run Analysis CTAs): glass field surfaces (`dd-glass-cold`), border-current hover + press physics on CTAs, kicker reveal on the section labels.
- Feature carousel ("weapons" cards): cold glass cards with hover sheen + lift; edge-faded rail (phase 7) for the carousel overflow.
- Hero display type untouched (it IS the brand) — but apply the gradient-text descender fix pattern if any clipping exists.

### 2. Home — signed-in portfolio
- League rows/stack and picker cards: cold glass rows, machined scrollbars, press physics, skeleton states per phase-7 standards.
- Recent-entry suggestions: glass chips.

### 3. Dialogs & pickers outside the report
- HomeDialogs / league dialogs / league switcher: `dd-glass-strong` chrome, spring tooltips where titles exist, focus-visible ring language.

### 4. SleeperHelper page
- Same treatment: glass panels, scrollbars, selection/focus polish, tabular numerals on any stats.

### 5. Low-touch surfaces
- Legal pages + NotFound: typography polish, selection color, scrollbars, one glass content card — nothing animated beyond entrance.
- Admin/diagnostics surfaces: tokens + scrollbars + tabular numerals only (function over flair, but no more flat-default surfaces).

### EXCLUDED (do not touch)
- The loading scene, success takeover/card, and LoaderKitBackdrop (paused workstream, distinct material by design).
- AI Tron surfaces (distinct material).
- Server, data, routing, copy — nothing functional.

## System work in the same pass

### A. Token consolidation
The glass/material values (fills, edge highlights, blur radii, grain) must live in ONE place (extend `premium-tokens.css` or the motion guidelines' companion CSS) consumed by both home and report layers — no copy-pasted rgba values per file. Migrate the phase-6 values there if they aren't already.

### B. CSS consolidation & shrink (the point of this phase)
Baseline (2026-06-12, before this roadmap's phases): **64,698 lines** across client/src/styles/ — report-responsive.css 21,669, report-foundation.css 18,832, report-surfaces.css 14,045. The roadmap's exit criterion is a styles directory SMALLER than that baseline:

- **Dead-rule sweep of the big three** (report-responsive, report-foundation, report-surfaces): find selectors whose class names appear nowhere in client/ source (grep-verified, conservative — dynamic class construction like template strings must be checked before deleting). Delete in batches with the evidence listed per batch.
- **Superseded-rule removal:** every surface the glass/motion system restyled in phases 2–7 must have zero remaining legacy surface rules. Audit for override stacking left behind by earlier phases and collapse it.
- **File retirement:** evaluate merging/retiring small legacy files where their content is superseded or near-empty after the sweep (premium-fx.css vs premium-polish.css overlap, home-backgrounds-v12.css after home converges, dd-tile-system.css vs cold-glass tiles). Retire = delete file + its import, with a migration note in the result.
- **Accounting:** report before/after line counts per file. Target: total styles directory at or below the 64,698 baseline DESPITE everything phases 2–8 added — meaning the sweep must remove more than the roadmap added.

### C. Convergence audit
Sweep for visual stragglers across client/: leftover flat-default cards, mismatched border radii (align to the existing radius scale), off-vocabulary easings/durations in any remaining CSS, inconsistent icon sizes in chrome. Fix the trivial ones; list anything non-trivial in the result summary rather than improvising.

### D. Guidelines final edition
Update `docs/animation-specs/motion-guidelines.md` into the complete design-language reference: materials (live/cold glass), motion vocabulary, chrome standards, where each applies, and the exclusion list above. A new contributor (or future Codex run) should need only this document.

## QA / acceptance criteria

1. `fnm exec --using 24.12.0 pnpm check` + `pnpm test` green, no new failures.
2. Home (signed-out + signed-in), dialogs, and SleeperHelper screenshot review: indistinguishable in language from the report — same glass, same hovers, same chrome.
3. Excluded surfaces byte-identical (git diff shows no changes to loader/success/Tron files).
4. No behavioral diffs: forms submit, dialogs open, navigation unchanged.
5. Token consolidation verified: grep shows no stray hardcoded glass rgba values outside the token layer.
6. Mobile pass at 375px on home + dialogs.
