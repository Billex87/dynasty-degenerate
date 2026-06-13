# Phase 12 — New demoed modules (Movers ticker, card flip, head-to-head, market pulse)

Status: ready
Designer/reviewer: Claude · Implementer: Codex
Build the four newly-approved demos and let them REPLACE the static equivalents they supersede (replace-don't-layer: delete superseded surface rules in the same diff, report net client/src/styles delta). Treat each as an independent module — a problem in one must not block the others. All gate on `useAnimationsEnabled`, dark theme + existing tokens (cyan #24f5ff up / orange #ff8a2a down), reduced-motion = final state, no CLS, no new deps. Reuse lib/motion primitives.

## 1. Always-on "Movers" ticker
A horizontal ticker of players whose value moved, ALWAYS shown (independent of the delta-brief's prior-snapshot requirement). This is distinct from the existing League Wire delta ticker — keep that one.
- Data: `reportData.weeklyRisers` + `weeklyFallers` (WeeklyMomentum[]). Show top movers, value + % change, cyan for up / orange for down, edge-faded rail (phase-7 mask), slow auto-drift pausing on hover/focus.
- Placement: top of the **Overview** tab (a "Market Wire" strip under the hero). Reduced motion: static, no drift.
- New component `client/src/features/report/components/MarketMoversTicker.tsx` (keep small).

## 2. Player card 3D flip
Front = player identity + value; back (flip on click/tap, or keyboard) = stat splits (pos rank, age, trend, tier).
- Placement: the **spotlight / featured player cards** in `ReportDashboardSpotlight.tsx` (single-featured surfaces that do NOT currently open the player modal). Do NOT add flip to the dense rankings tiles — those keep their click→PlayerDetailModal behavior untouched (the modal already holds the deep info + draw-on chart).
- Implement with a CSS 3D flip (rotateY, preserve-3d, backface-hidden), ~600ms EASE_RISE. Accessible: the back content also present for AT; flip toggles `aria-pressed`. Reduced motion: instant swap, no 3D spin.
- This REPLACES the current static spotlight card styling — delete the superseded rules.

## 3. Head-to-head tug-of-war
A value "tug of war" bar between two managers.
- Placement: a new module in the **Owner Intel Lab** (Rankings tab) — viewer's manager vs the #1-value manager by default (if the viewer IS #1, compare vs #2). If a manager selector is trivially available, allow picking the rival; otherwise default pairing is fine.
- Data: manager `totalValue` from the report's manager intelligence. Bar fills from each side, the center "knot" springs (useSpringValue) to the value-weighted position, the leading side's value counts up. Cyan = viewer, orange = rival.
- New component `client/src/features/report/components/HeadToHeadTug.tsx`. If a static manager-comparison element exists in that area that this supersedes, replace it.

## 4. Market-pulse EKG
A league-activity heartbeat line — each spike = recent league transaction volume.
- Data: `reportData` recent-transaction data (RecentTransaction[]). Bucket transactions over the recent weeks available and draw an EKG line (the bigger the bucket, the taller the spike) via `useDrawPath` (draw on first view).
- **Honesty clause:** if the transaction data lacks usable timestamps/weeks to bucket a timeline, do NOT fabricate — scope it to what's available (e.g., a recent-activity count sparkline) and report exactly what the data supports.
- Placement: **Momentum tab** header area (it's about league activity). New component `client/src/features/report/components/MarketPulseLine.tsx`.

## Acceptance criteria
1. `fnm exec --using 24.12.0 pnpm check` + `pnpm test` green, no new failures (add focused tests for any pure helpers, e.g. mover formatting / transaction bucketing).
2. Movers ticker shows on a FIRST report (no prior snapshot needed); League Wire delta ticker still works separately.
3. Spotlight card flips front/back; rankings tiles still open the modal (unchanged).
4. Head-to-head renders viewer vs rival with the spring knot; values from real manager totals.
5. Market pulse draws on view (or the reported scoped fallback).
6. Each module independent; reduced motion = static; replace-don't-layer honored with net styles delta reported.
7. Report which static elements (if any) were replaced.
