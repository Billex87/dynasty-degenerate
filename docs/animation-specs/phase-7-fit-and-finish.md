# Phase 7 — Fit & finish (animation roadmap, package 7)

Status: blocked on phase 6
Designer/reviewer: Claude · Implementer: Codex
Goal: the chrome details that make the whole app feel machined — nothing here is a feature, all of it is felt.

## Items

### 28. Machined scrollbars
Every scrollable surface in the report (tables, modals, scroll rails) gets the house scrollbar: thin (8px), rounded thumb in translucent cyan (rgba accent, brighter on hover), near-invisible track. `::-webkit-scrollbar*` plus `scrollbar-width: thin; scrollbar-color:` for Firefox. One definition in the report style layer, applied via the report shell — not per component.

### 29. Reading beam
A 2px cyan progress beam fixed to the top of scrollable report content showing scroll progress (passive scroll listener writing a CSS var; no rAF churn, no re-renders). Apply to: the report shell main scroll and the player modal body. Hidden under reduced motion? No — it's positional feedback, not motion; it stays. Hide on touch viewports under 700px (thumb-scroll makes it redundant noise).

### 30. Glass tooltips
One tooltip primitive (glass material from phase 6 `dd-glass` recipe, small spring entrance: opacity + translateY(6→0) + scale(.92→1), `EASE_OVERSHOOT`, ~250ms; ~350ms hover delay before showing). Replace bare `title=` attributes on report surfaces (value chips, rank badges, trend rings, FAAB ranges) with it. Keyboard-accessible (shows on focus-visible), `role="tooltip"`, never blocks pointer events.

### 31. Layout-stable skeletons
Audit report loading states: every skeleton must occupy EXACTLY the final rendered dimensions (zero CLS when data lands), with the house shimmer (translateX gradient sweep in faint cyan, 1.4s). Replace any spinner-style or mismatched-size placeholder in report surfaces with skeletons matching their loaded layout. Skeleton shimmer pauses under reduced motion (static fill stays).

### 32. Edge-faded rails
Every horizontal scroller/overflow row (trending players, chip rows, draft class rails) gets `mask-image` edge fades (7% each side) instead of hard clips. Pure CSS utility class. Optional slow auto-drift ONLY where content is purely ambient (no interactive elements lost off-screen), pausing on hover/focus — judge per surface, default to no drift.

### 33. Text + number polish
- `font-variant-numeric: tabular-nums` on ALL stat/value/rank displays (tables, metric cards, odometer surfaces) so columns align and count-ups don't wobble width.
- `::selection` styled: cyan fill, dark text.
- One consistent `:focus-visible` ring language across report controls: 2px cyan ring + 2px offset (replace mixed ring styles).
- Number formatting house style: document in motion-guidelines.md when values render as 48,210 vs 48.2K (full precision in tables/tooltips, compact in tiles/headlines) and align outliers found during implementation.

### 34. Branded micro-loader
Replace generic spinners in report surfaces (button-level loading, small panel refreshes — NOT the main league loading scene) with a 16–20px spinning spiral football outline (single SVG path, stroke-dash spin, cyan). One component in the report primitives.

### 35. View transitions (progressive)
Where supported (`document.startViewTransition`), wrap report tab changes and league switches for a single coherent crossfade instead of independent enter animations — feature-detected, zero effect elsewhere, must not double-animate with the phase-2 tab enter (when view transitions run, suppress the motion-reveal x-slide).

## Constraints

- All motion gates on `useAnimationsEnabled()` (except the reading beam and static glass, as noted).
- No new dependencies. No CLS introduced anywhere; item 31 actively removes CLS.
- Keep everything in the existing token vocabulary; update `docs/animation-specs/motion-guidelines.md` with: scrollbar/tooltip/skeleton/rail/focus standards and the number-formatting house style.

## QA / acceptance criteria

1. `fnm exec --using 24.12.0 pnpm check` + `pnpm test` green, no new failures.
2. Scrollbars themed on every report scroller (verify tables, modal, rails) in Chrome + Safari + Firefox.
3. Reading beam tracks scroll on report shell and player modal; absent on small touch viewports.
4. Tooltips: hover + keyboard focus both work; no clipped tooltips at viewport edges.
5. Skeleton-vs-loaded screenshot overlay shows zero layout shift on the dashboard metrics, player tiles, and tables.
6. Rails fade at edges; no interactive element becomes unreachable.
7. Tabular numerals verified on tables and count-ups (no width wobble during counting).
8. View transitions: tab switch uses a single coherent transition in Chrome; Firefox/Safari fall back to phase-2 behavior exactly as today.
