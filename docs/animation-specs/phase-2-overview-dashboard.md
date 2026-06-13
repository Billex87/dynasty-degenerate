# Phase 2 — Overview/dashboard animations (animation roadmap, package 2 of 4)

Status: blocked on phase 1 (lib/motion foundation) landing
Designer/reviewer: Claude · Implementer: Codex
Covers roadmap items: #1 staggered entrance, #2 count-up metrics + delta pulse, #5 tab transitions, #7 odometer headline value, #8 broadcast delta ticker, #9 position bar race.

## Ground rules

- All primitives come from `@/lib/motion` (phase 1 barrel). Do not import framer-motion outside `client/src/lib/motion/`.
- Every animation gates through `useAnimationsEnabled()` — reduced motion renders final state.
- Style with the existing dark war-room system (cyan `#24f5ff` / orange `#ff8a2a`, tokens in `client/src/styles/premium-tokens.css`). No new colors, no parallel design system.
- New CSS (pulse keyframes, bar transitions) goes in the existing report style files (`report-surfaces.css` for surface effects), namespaced `dd-motion-*`.
- Animations must not change layout or cause CLS — animate transform/opacity only (width transitions allowed inside the existing bar track elements).

## Items

### #1 Staggered section entrance
Where: `ReportDashboardContent.tsx` tab bodies — the `report-command-section-stack` children (CollapsibleReportSection blocks) and the hero metrics grid.
- Hero metrics grid: `StaggerGroup` on mount, `STAGGER_STEP.base`, y 14.
- Section stacks: each `CollapsibleReportSection` wrapper animates with `in="view"` (whileInView, once) so long tabs reveal as you scroll, not all at load.
- First paint of the overview tab after report generation is the hero moment — it must stagger every time the report opens, but NOT re-trigger when switching back to an already-visited tab (track visited tabs in component state).

### #2 Count-up metrics + delta pulse
Where: the hero metrics assembled for `ReportDashboardMetrics` components (`reportDashboardUtils.ts` builds `DashboardHeroMetric`s).
- Numeric metric values animate with `useCountUp` on first view (900ms). Only pure-number values count up — metrics whose `value` is a name/ReactNode render unchanged. Prefer extending `DashboardHeroMetric` with an optional `numericValue?: number` + `valueFormatter?` so call sites opt in explicitly rather than parsing ReactNode.
- `DashboardDeltaMetric` (`data-direction` up/down): when it enters view, pulse once — scale 1 → 1.12 → 1 on the value, 500ms, `EASE_POP`, plus a one-shot background flash keyed to tone (cyan-tinted for `good`/up, orange-tinted for `warn`/down) via a `dd-motion-delta-pulse` CSS class.

### #5 Tab transitions
Where: `ReportDashboardContent.tsx`, the `TabsContent value="..."` blocks (`report-tab-content`).
- Radix unmounts inactive tabs, so do enter-only: wrap each TabsContent's children in a motion container that animates opacity 0→1 and x 18→0 over `DURATION.fast`–280ms with `EASE_RISE` when the tab mounts.
- No exit animations (don't add forceMount — keeps perf and DOM simple).
- The existing `dd-report-tab-materialize` CSS keyframe becomes redundant if it targets the same element — remove the overlap rather than double-animating.

### #7 Odometer headline value
Where: the single primary team-value metric in the hero row (the headline number of the report).
- Replace its static value with `<Odometer value={n} />`. Just the one headline — secondary metrics use plain `useCountUp` (#2). Two rolling treatments side by side cheapens both.
- Make sure font metrics hold: Odometer inherits the StatTile value typography; verify no vertical clipping with the tile's line-height (gradient-text descender clipping has bitten this codebase before — avoid background-clip text inside the odometer).

### #8 Broadcast delta ticker
Where: `ReportDeltaBrief.tsx` (`ReportSinceLastReportBrief`).
- Current: up to 3 change articles rendered statically. Add a "league wire" rotation: the article list keeps its layout, but a compact ticker line in the brief header cycles through ALL `changes` (not just visible 3) — label + summary sliding up every ~3.5s (300ms slide, EASE_RISE), looping.
- Pause rotation on hover/focus-within (accessibility), and entirely static (first change shown) under reduced motion.
- Keep the existing articles and follow-change buttons untouched — the ticker is additive.

### #9 Position bar race
Where: `DashboardMiniBarStack` in `ReportDashboardMetrics.tsx` — bars already render width via `--dashboard-bar-score`.
- On first view: bars grow from 0 to their score with a CSS width transition (1s, `EASE_RISE` as cubic-bezier string), staggered ~120ms per row (transition-delay), values count up alongside via `useCountUp` when `displayValue` is numeric.
- The leading bar (max value) gets a one-shot `dd-motion-bar-lead` flash when the race settles (~1.3s).
- Implementation: a `data-animate-in` attribute toggled by an in-view effect; CSS handles the rest. Reduced motion → bars render at full width immediately.

## QA / acceptance criteria

1. `pnpm check` and `pnpm test` pass.
2. Report opens with: staggered hero, counting metrics, rolling headline odometer — then sections reveal on scroll. Switching tabs slides content in; revisited tabs do not re-stagger.
3. Delta brief ticker cycles and pauses on hover.
4. Mini bar stacks race on first view only.
5. With `prefers-reduced-motion: reduce`: zero movement, all final values shown instantly.
6. No layout shift: verify the metrics row height is identical before/after animation.
7. Visual QA on the running app (desktop + one mobile viewport) — the repo's `pnpm run audit:ui` and Playwright setup are available.
