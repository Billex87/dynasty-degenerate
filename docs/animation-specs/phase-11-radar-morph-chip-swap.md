# Phase 11 — Radar morph toggle + trade chip-swap (close the two demo gaps)

Status: ready
Designer/reviewer: Claude · Implementer: Codex
Closes the two report-side demos that didn't ship: the radar build-morph toggle and the trade chip-swap. Keep all existing motion vocabulary, dark theme, reduced-motion gating, and the replace-don't-layer rule.

## A. Radar build-morph toggle (`client/src/features/report/components/TeamProfileRadar.tsx`)

Currently the radar draws the viewer's profile vs the league median (you-vs-median), animating in. Add a toggle that morphs the viewer polygon between two weightings of the SAME underlying Blueprint factors — no new data:
- **Dynasty/current weighting** (today's axes) and a **win-now weighting** that re-weights the existing factor scores (emphasize star power + current starter value, de-emphasize youth + draft capital). Derive the win-now axis values by reweighting the factors already computed via `gradeRoster`/`rosterAggregates` — do NOT invent new data; if a factor genuinely has no win-now interpretation, keep its value.
- A small two-state toggle ("Dynasty" / "Win-now") styled as the existing glass pill group. On toggle, the viewer polygon interpolates its radii between the two weightings (~600ms, ease-out cubic, the existing rAF interpolation). The league-median reference polygon stays fixed.
- Reduced motion: snap to the selected weighting, no interpolation.
- Label the active weighting; keep hues unchanged (cyan viewer, dashed median).

## B. Trade chip-swap (`client/src/components/reportTables/TradeWarRoom.tsx` trade suggestion view)

When the user moves between trade suggestions (or toggles a package variant) for the same partner, the player/pick chips that change sides should animate ACROSS the give/get columns instead of hard-swapping.
- Implement with framer-motion shared-layout: wrap the give+get chip columns in a `LayoutGroup`, give each chip a stable `layoutId` keyed by player/pick id, and let framer animate position when a chip moves columns (the existing `FlipItem`/`layout` from lib/motion, or `layoutId` if the chip unmounts in one column and mounts in the other).
- **Honesty clause:** if the current trade DOM genuinely remounts chips in separate React trees such that `layoutId` can't bridge them without a real structural refactor, do NOT force a brittle hack — ship the chips' deal-in/positional motion you CAN do cleanly and report exactly what blocked the cross-column swap and what restructure it would need. A correct partial is better than a fragile full.
- Gate on `useAnimationsEnabled`; reduced motion = instant.

## Acceptance criteria
1. `fnm exec --using 24.12.0 pnpm check` + `pnpm test` green, no new failures.
2. Radar: toggling Dynasty/Win-now morphs the viewer polygon smoothly; median reference unchanged; reduced motion snaps.
3. Trade chips: moving between suggestions animates chips across columns — OR a clean partial with a written explanation of the blocker.
4. No new deps; dark theme + existing tokens; report net `client/src/styles` line delta; delete any superseded rules.
5. No regressions to phases 1–10.
