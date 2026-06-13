# Phase 1 — Motion foundation (animation roadmap, package 1 of 4)

Status: ready for implementation
Designer/reviewer: Claude · Implementer: Codex

## Context

We are adding 15 approved animations across the generated-report experience (phases 2–4 will cover overview/dashboard, rankings/charts, and trades/AI surfaces). Phase 1 builds the shared motion foundation those phases consume.

`framer-motion` ^12 is already in package.json but is imported nowhere in `client/` today — this phase introduces it as the single animation runtime for report-side motion. Do not add GSAP or any other dependency.

No production report surface changes in this phase. The only visible output is a new "Motion foundation" QA section on the existing `client/src/pages/ReportComponentShowcase.tsx` page.

## Deliverables

New directory `client/src/lib/motion/` — small focused files per AGENTS.md:

### 1. `motionTokens.ts`
Named constants only, no logic:
- `DURATION = { fast: 180, base: 320, settle: 450, count: 900, draw: 1100 }` (ms)
- `EASE_RISE: [number, number, number, number] = [0.2, 0.8, 0.3, 1]` — entrances/settles
- `EASE_OVERSHOOT = [0.2, 0.9, 0.3, 1.2]` — playful pops (cards, chips)
- `EASE_POP = [0.14, 0.84, 0.14, 1]` — matches existing `dd-score-count-pop` keyframe feel
- `STAGGER_STEP = { tight: 60, base: 90, loose: 130 }` (ms)
- `cssEase(ease)` helper → `"cubic-bezier(...)"` string for style usage.

### 2. `motionMath.ts` (pure functions — unit tested)
- `clamp01(n)`
- `easeOutCubic(p)`
- `formatCount(value: number, opts?: { plus?: boolean })` → grouped string via `toLocaleString("en-US")`, optional `+` prefix for positives, rounds to integer.
- `splitDigits(formatted: string)` → `Array<{ kind: "digit"; digit: number } | { kind: "char"; char: string }>` — Odometer consumes this so digit-mapping is testable in node.

### 3. `useAnimationsEnabled.ts`
Hook returning `boolean`. Wraps framer-motion's `useReducedMotion()` (true → animations disabled). All other primitives consume this — it is the single reduced-motion gate. SSR-safe (default to enabled=false until mounted is NOT acceptable — default to enabled, matchMedia guard like `SuccessCard3D.tsx` does).

### 4. `useCountUp.ts`
`useCountUp(target: number, opts?: { durationMs?; formatter?; plus? }) => string`
- First render animates 0 → target; subsequent target changes animate previous → new (important for live league data), using `easeOutCubic` via rAF.
- Cancels rAF on unmount and on target change.
- Reduced motion (via `useAnimationsEnabled`) → returns final formatted value immediately, no rAF.
- Every displayed frame goes through `formatCount` (no float artifacts).

### 5. `Odometer.tsx`
Per-digit rolling number (the premium headline treatment).
- Props: `{ value: number; durationMs?: number; digitStepMs?: number; plus?: boolean; className?: string }`.
- Format with `formatCount`, split with `splitDigits`. Digit columns: inline-block, `overflow: hidden`, height `1em`, containing a 0–9 strip translated `-digit * 1em` with CSS transition (`EASE_RISE`), per-digit delay `index * digitStepMs` (default 130ms). Separator chars render static. Inherits font from parent — no hardcoded sizes/colors.
- Value changes roll from the previous value's digits (pad shorter value with leading zeros so columns line up).
- Accessibility: wrapper has `aria-label` with the final formatted value; digit strips `aria-hidden`.
- Reduced motion → render plain formatted text.

### 6. `Stagger.tsx`
`StaggerGroup` + `StaggerItem` built on framer-motion variants.
- Group props: `{ delayStepMs?: number; initialDelayMs?: number; y?: number; in?: "mount" | "view"; className?: string }` — defaults `STAGGER_STEP.base`, `y: 14`, `"mount"`. `"view"` uses `whileInView` with `viewport={{ once: true }}`.
- Item: opacity 0→1, translateY `y`→0, `DURATION.settle`, `EASE_RISE`.
- Reduced motion → children render in final state (no animation, no layout difference).

### 7. `DrawPath.tsx`
SVG stroke draw-on.
- Export hook `useDrawPath(ref: RefObject<SVGPathElement>, opts?: { durationMs?; delayMs?; replayKey?: unknown })` — measures `getTotalLength()`, sets dasharray/dashoffset, transitions to 0. `replayKey` change re-runs it.
- Also export thin component `DrawPath` for simple cases: `{ d, stroke, strokeWidth?, durationMs?, delayMs?, strokeLinecap? }`, `fill="none"`.
- Reduced motion → path fully drawn immediately.

### 8. `index.ts`
Barrel re-exporting the public surface.

### 9. `motionMath.test.ts`
Vitest, node environment (no jsdom, no component tests — repo test include is `*.test.ts` only):
- `easeOutCubic`: 0→0, 1→1, monotonic over [0,1].
- `formatCount`: grouping (`48210` → `"48,210"`), `plus` prefix on positives only, rounds floats.
- `splitDigits`: digits and separators tokenized correctly, round-trips the formatted string.
- `motionTokens`: durations positive, easing tuples length 4.

### 10. Showcase QA section
Add a "Motion foundation" section to `client/src/pages/ReportComponentShowcase.tsx` following that page's existing section pattern (extract a component if the page would grow large — AGENTS.md says no large route files):
- `Odometer` rolling to 48,210 + replay button.
- `useCountUp` on three metric values (one with `plus`).
- `StaggerGroup` of four placeholder cards + replay (remount via key).
- `DrawPath` drawing a 12-point polyline + replay.
Style with existing report surface classes/tokens (`premium-tokens.css` vars) — dark surface, no new global CSS.

## Constraints

- No new dependencies. framer-motion imports must stay inside `client/src/lib/motion/` (single integration point — later phases import from the barrel only).
- Do not touch production report components, styles, or the loader/success scenes in this phase.
- TypeScript strict; follow existing `client/src/lib/` conventions (named exports for helpers/hooks; component files may default-export like the rest of the repo).
- Keep each file small and focused.
- `pnpm check` and `pnpm test` must pass.

## Acceptance criteria

1. `pnpm check` and `pnpm test` pass; new motionMath tests included and green.
2. `client/src/lib/motion/` exists with the files above; framer-motion imported nowhere else.
3. Showcase page renders all four primitives with working replay controls on the dark report surface.
4. With `prefers-reduced-motion: reduce`, every primitive shows its final state immediately (no rAF loops, no transitions).
5. No production report surface is visually changed.
