# Phase 3 — Rankings & chart animations (animation roadmap, package 3 of 4)

Status: blocked on phase 1 foundation (and phase 2 conventions)
Designer/reviewer: Claude · Implementer: Codex
Covers: rankings FLIP self-sort, sparkline pop-ins, draw-on value history chart, roster heat-grid ripple, team profile radar.

## Ground rules

Same as phase 2: all motion via `@/lib/motion`; framer-motion imports stay inside `client/src/lib/motion/`; everything gates on `useAnimationsEnabled()`; team-colour dark theme via existing tokens; transform/opacity only (stroke-dash for SVG); no CLS.

This phase may EXTEND `client/src/lib/motion/` with two primitives (keep them generic, tested where pure):
- `FlipList` / `FlipItem` — framer-motion `layout` wrappers for reorder animations (500ms, `EASE_RISE`, optional per-index delay).
- `useSpringValue(target, { stiffness, damping })` — rAF damped spring returning a number (needed in phase 4 too).

## Items

### Rankings FLIP self-sort
Where: `client/src/components/RankingsBoard.tsx` — rows re-order on `SortMode` change ('rank' | 'value' | 'movement' | 'prospect' | 'age') and pagination renders `pageRows`.
- Wrap row lists in `FlipList`; rows keyed by stable player/team id. Sort-mode changes animate rows to their new positions; page changes do NOT animate (fresh mount).
- The viewer's row (existing viewer-highlight logic in `client/src/lib/viewerHighlight.ts`) gets a one-shot `dd-motion-row-flash` background flash (cyan-tinted, 1.2s ease-out) after the sort settles.
- Initial reveal: rows stagger in with `in="view"` StaggerGroup semantics (tight step — these are dense lists, 40–60ms).

### Sparkline pop-ins on ranking rows
Where: same rankings rows, using per-row trend/movement data that already powers the 'movement' sort.
- Each row that has trend data gets a ~56×18 inline SVG sparkline: path draws on first view via `useDrawPath` (600ms, staggered with the row), end-dot pops after the draw, delta value fades in last.
- Cyan stroke for positive movement, orange for negative (existing token colours). Rows without data render exactly as today.
- Keep the SVG generation in a small pure helper (testable): `buildSparklinePath(points, width, height)` → `d` string. Unit-test it.

### Draw-on value history chart
Where: `client/src/components/PlayerDetailModal.tsx`, `PlayerValueTimelineCard` (defined ~line 2509). Two SVG surfaces: the mini trend (~lines 2619–2639, two stacked `<path>` strokes — dark halo + colour) and the detail chart (~lines 2959–2991, `chartPath` strokes + `chartAreaPath` gradient fill).
- On mount and on timeline-window/tab change (`getTimelineWindowTabs`): both stroke paths draw left-to-right together via `useDrawPath` (`DURATION.draw`, same dasharray params so halo and colour stay in sync); the area path fades 0 → current opacity starting ~70% through the draw; any "now"/end marker pops last.
- `replayKey` = active window key + value mode, so switching 1M/3M/6M windows re-draws.
- Server hydration (`isServerHydrating`) must not retrigger the draw when data refines — only window/mode changes replay.

### Roster heat-grid ripple
Where: the existing player tile grids in the report sections (`player-team-tile` tiles — rankings/owner-intel/momentum roster grids).
- Tiles reveal with a ripple: opacity 0→1 + scale .94→1, delay `min(index * 45ms, 600ms)`, triggered once per grid on first view.
- Tiles whose existing tone/tier marks them as top assets get a one-shot subtle pulse after the ripple completes (~1.2s in).
- Pure CSS driven by a `data-animate-in` attribute + per-tile `--dd-motion-delay` custom property; no per-tile JS timers.

### Team profile radar
Where: new component `client/src/features/report/components/TeamProfileRadar.tsx` (keep under ~180 lines), placed in the Rankings tab's team-overview `CollapsibleReportSection` (top of `ReportRankingsTab.tsx`).
- Data: derive 5 axes from what `@shared/blueprint` already computes (`gradeRoster`, `client/src/lib/blueprint/rosterAggregates.ts`, `leagueComparatives.ts`) — e.g. youth, star power, depth, draft capital, momentum. Use whichever five factors are genuinely available; do not invent data.
- Render: SVG radar, dashed league-median polygon (computed from all rosters), solid cyan viewer polygon with translucent fill.
- Animate: viewer polygon grows axis-by-axis from center on first view (rAF interpolation, ~80ms per-axis stagger, 600ms each, ease-out cubic). If a second weighting (win-now vs dynasty/current value mode) is already computable from existing data, add a small toggle that morphs the polygon (interpolate radii, 600ms); otherwise ship you-vs-median only — do not bolt on new scoring.
- Reduced motion: polygon renders complete immediately.

## QA / acceptance criteria

1. `pnpm check` + `pnpm test` pass (including new `buildSparklinePath` tests).
2. Rankings: switching sort modes animates rows to new positions with the viewer row flashing; pagination doesn't animate.
3. Player modal: value chart draws on open and re-draws on window change, not on server hydration.
4. Tile grids ripple once per view; no animation on re-render.
5. Radar shows real factor data with the league median reference; morphs only if the toggle shipped.
6. Reduced motion: everything instant. No CLS anywhere.
7. Visual QA in the running app, desktop + one mobile viewport.
