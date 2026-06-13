# Phase 5 — Signature micro-interactions & motion governance (animation roadmap, package 5)

Status: blocked on phase 4
Designer/reviewer: Claude · Implementer: Codex
Covers batch-4 approvals: border current, press physics, live data blip, kicker reveal, avatar trend ring, cursor-reactive grid — plus the governance work that keeps the whole system premium.

## Design intent (read first)

This phase is the sub-300ms layer. Nothing in it should be noticeable on its own — only missed when absent. Hard rules:
- Micro-interactions ≤ 300ms; reveals ≤ 450ms. One-shots only — nothing loops except deliberately ambient pieces that already exist (ticker, live dots).
- One hero moment per view: the report open owns the big stagger/odometer. Everything in this phase must never compete with it.
- Every duration/easing comes from `motionTokens`. No bespoke curves.
- All gated by `useAnimationsEnabled()`; hover effects additionally by `@media (hover: hover)` / `(pointer: fine)`.

## Items

### 16. Border current (signature hover)
A single thin streak of light (2px, cyan, soft glow per existing token treatment) travels along the top border once per hover-enter (~550ms ease-out), with a subtle border-color lift while hovered. Focus-visible triggers it too.
- Implement as one shared CSS pattern (`dd-current` + a pseudo-element or dedicated span), defined once in the report style layer.
- Apply to: report cards/tiles (StatTile surfaces, player tiles, collapsible section summaries) and primary CTAs. This is the house hover language — consistent everywhere, no per-surface variants.
- Touch devices: no traveling streak (no hover), keep the existing press states.

### 17. Press physics (global)
All buttons/pressable tiles: scale(0.96) on press with a ~60ms ease-in, release springs back with `EASE_OVERSHOOT` (~350ms). Transform only.
- Route through the shared button primitive(s) and the report CTA/tile classes — one definition, not per-component sprinkles.

### 18. Live data blip
When a mounted metric's value CHANGES (value-mode switch, data refresh — never on initial mount): the number ticks to the new value (existing count-up from previous value already supports this), flashes the accent color ~200ms, and a small `+Δ` / `−Δ` floater rises and fades (~900ms, absolutely positioned, `aria-hidden`, zero layout impact).
- Add a `useValueBlip` (or equivalent) primitive in `client/src/lib/motion`. Wire into `DashboardMetricValue` and the player value cells that re-render on dynasty/redraft lens switches.
- Only fire for non-zero deltas; if many values change in one pass, floaters appear only on the viewer-relevant headline metrics (avoid confetti-storm).

### 19. Kicker reveal
Section kickers (the small uppercase labels) settle letter-spacing from slightly-wide to final while fading in, and a short accent rule under them draws scaleX 0→1 (`transform-origin: left`, ~450ms total, orange accent).
- Trigger on first in-view reveal only, riding the existing section reveal markers from phases 2–3. CSS-only on top of those markers.
- Apply to the shared section header primitives (ReportSectionHeader, CollapsibleReportSection summaries) so it's everywhere automatically.

### 20. Avatar trend ring
Manager avatars get a thin arc ring (2–2.5px) sweeping on first view (~700ms): cyan arc length ∝ positive 7-day roster-value trend, orange for negative. Data comes from trend/momentum values the report already computes — do not invent data; no ring when no data.
- New `ManagerTrendAvatar` wrapper around the existing avatar render. Apply where managers appear at ≥32px (standings/manager rank rows, spotlight, owner intel). Skip tiny inline avatars.
- Tooltip/title text with the exact delta for hover.

### 21. Cursor-reactive grid
Desktop only (`pointer: fine` + animations enabled): the war-room background grid subtly brightens in a radius around the cursor. Barely perceptible — opacity ceiling ~0.08 over baseline.
- One rAF-throttled pointermove listener at the report shell level writing `--dd-cursor-x/--dd-cursor-y` custom properties; CSS does the rest (mask/radial positioning on the existing grid layer). Zero React re-renders, transform/opacity/mask only, no repaint storms — verify with a quick performance trace.
- Disable while the loading scene or modals are up.

## Governance work (same PR)

### A. Legacy keyframe audit
The styles layer predates `lib/motion` and carries ~60 `dd-*`/`ai-*` keyframes. Inventory them; delete only the ones that are provably unreferenced (grep class + keyframe name across client/) or superseded by this system (like the removed `dd-report-tab-materialize`). For kept ones that duplicate token timings, align durations/easings to `motionTokens` values where the change is visually neutral. List every removal/change in your result summary — conservative beats clever here.

### B. Motion guidelines doc
Write `docs/animation-specs/motion-guidelines.md`: the vocabulary (tokens, the three easings, duration ceilings), the one-hero-moment rule, the gating contract (`useAnimationsEnabled`, hover/pointer gates), and where each primitive lives. Future animation work must be able to onboard from this one page.

### C. User "Effects" toggle
A persisted reduce-effects override, independent of the OS setting:
- `useAnimationsEnabled()` returns false if EITHER prefers-reduced-motion OR the stored user preference (localStorage, e.g. `dd-reduce-effects=1`) is set. Subscribe so flipping it applies live without reload.
- Toggle UI in the report footer controls (next to AI voice/admin buttons), labeled "Effects" with on/off state. Default on.

## QA / acceptance criteria

1. `fnm exec --using 24.12.0 pnpm check` and `pnpm test` pass, no new failures.
2. Border current appears on card hover and focus-visible everywhere tiles/CTAs render; never on touch.
3. Press physics on all primary buttons; no layout shift anywhere in this phase.
4. Value blips fire on lens switch but never on first paint.
5. Kicker reveals ride existing section reveals; trend rings only render with real trend data.
6. Cursor grid: imperceptible CPU cost, no re-renders, gone on touch/reduced motion.
7. Effects toggle kills all motion live, including hover effects; OS reduced-motion still respected independently.
8. Keyframe audit documented with the removal list; guidelines doc exists.
