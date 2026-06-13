# Phase 4 — Trades, AI & spotlight animations (animation roadmap, package 4 of 4)

Status: blocked on phases 1–3
Designer/reviewer: Claude · Implementer: Codex
Covers: trade cards deal-in + chip swap, trade verdict meter, Blueprint grade stamp, spotlight tilt card, AI readout typewriter.

## Ground rules

Same as phases 2–3: motion via `@/lib/motion` only; `useAnimationsEnabled()` gates everything; existing dark-theme tokens; transform/opacity only; no CLS; no new deps.

May extend `client/src/lib/motion/` with:
- `useTilt(ref, { maxX, maxY })` — pointer-tracking tilt for `pointer: fine` devices only.
- (uses `useSpringValue` from phase 3.)

## Items

### Trade cards deal-in + chip swap
Where: `client/src/features/report/components/ReportTradesTab.tsx` — trade suggestion tiles (`player-team-tile` variants).
- Deal-in: suggestion cards enter with stagger + slight rotation (-2deg → 0, `EASE_OVERSHOOT`, ~130ms step) on first view of the trades section.
- Chip swap: when the user moves between trade suggestions for the same partner (or toggles a package variant), the player/pick chips that move sides animate across via `FlipItem` layout animation. If the current DOM structure can't support cross-column layout animation cleanly (chips unmount/remount in separate trees), ship deal-in only and say so explicitly in the result summary — do not force a hack.

### Trade verdict meter
Where: trades tab, wherever a suggestion's value differential renders (value data per `client/src/lib/tradeValueCalibration.ts`).
- New small component `TradeVerdictMeter`: horizontal track (give-side orange tint, get-side cyan tint, center tick), needle driven by `useSpringValue` so it springs past the target and wobbles to rest; a verdict chip ("favors you +X%" / "favors them") fades in once the needle settles.
- The percentage label counts with the needle (same spring value, formatted via `formatCount`).
- Reduced motion: needle and chip render at final state.

### Blueprint grade stamp
Where: wherever `gradePlayer` / Blueprint grades render for a player (locate usages of `@shared/blueprint/playerGrading` in the client; expected in the player detail modal / owner-intel roster views).
- Grade ring: circular progress sweeps to the score via stroke-dashoffset (`DURATION.draw * 0.8`), score number counts up in the center.
- Letter grade stamps in at 60% of the sweep: scale 2.2 → 1 with `EASE_OVERSHOOT`, slight -8deg rotation, plus a one-shot 8-particle CSS burst (tiny dots radiating ~36px, 500ms, then gone). Particles are decorative `aria-hidden` spans.
- One-shot per modal open / per view; never replays on re-render.

### Spotlight tilt card
Where: `client/src/features/report/components/ReportDashboardSpotlight.tsx` cards (and the next-move target card if it shares the spotlight surface).
- `useTilt`: max ~8deg X / 10deg Y following the pointer, inner content layers get slight counter-parallax (avatar ±6px, copy ±3px), spring-back on pointer leave (~450ms `EASE_RISE`).
- Gate on `matchMedia("(pointer: fine)")` AND `useAnimationsEnabled()` — touch devices get the static card. No tilt while a drag/selection is active inside the card.

### AI readout typewriter
Where: `client/src/components/AIReadPanel.tsx` — the body render (`<div className="ai-read-body">{typeof body === 'string' ? <p>{body}</p> : body}</div>`, ~line 606).
- String bodies only: type out at ~18ms/char with a blinking block cursor (cyan, CSS keyframe); cursor fades 700ms after completion. Non-string bodies render unchanged.
- Accessibility is non-negotiable: render the full text immediately for screen readers (visually-hidden complete copy with the existing aria semantics; the animated visible copy is `aria-hidden`). No `aria-live` re-announcement spam per character.
- Type once per readout content (key by a hash/identity of the body string); content updates re-type only when the string actually changes. Skip entirely (instant full text) when the panel re-mounts with previously-shown content where feasible — at minimum, never loop.
- Reduced motion: full text instantly, no cursor.
- This component backs every AI surface in the app (see `decisionDisplay` prop) — verify verdict/context chips and trace sections are untouched and the typing doesn't delay their appearance.

## QA / acceptance criteria

1. `pnpm check` + `pnpm test` pass.
2. Trades: cards deal once per view; verdict needle springs and settles with the chip appearing after rest; chip swap animates or is explicitly reported as descoped with the reason.
3. Grade stamp sweeps, stamps, bursts — once.
4. Tilt only on fine-pointer devices; spring-back clean; no tilt on touch.
5. AI readouts type once, screen readers get full text immediately, every `decisionDisplay` variant still renders correctly.
6. Reduced motion: all final states instant. No CLS.
7. Visual QA in the running app, desktop + one mobile viewport.
