# Phase 6 — Liquid glass surface system (animation roadmap, package 6)

Status: blocked on phase 5
Designer/reviewer: Claude · Implementer: Codex
Goal: a frosted "liquid glass" surface language across tabs, tables, and key cards — premium, restrained, and unmistakably ours (glass over circuitry, in team colours).

## The recipe (single source of truth)

One utility layer in the report styles (namespaced `dd-glass*`), not per-component snowflakes:

```css
/* base glass (dark war-room) */
background: rgba(16, 28, 48, 0.42);
backdrop-filter: blur(14px) saturate(1.5);
-webkit-backdrop-filter: blur(14px) saturate(1.5);
border: 1px solid rgba(255, 255, 255, 0.10);
box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12),   /* specular top edge */
            inset 0 -1px 0 rgba(2, 7, 18, 0.5);        /* grounded bottom */
```

Variants:
- `dd-glass-soft` — table headers / secondary chrome: blur(8px), fill opacity .55.
- `dd-glass-strong` — modals/dialogs: blur(20px), fill opacity .55, stronger edge.
- Tint accents stay on the existing token colours only (cyan/orange edges, never new hues). The colour comes from what's BEHIND the glass — the existing ambient surfaces do the work.

## Two tiers — this is how "glass everywhere" stays fast

**Tier 1 — live glass (`dd-glass`, `dd-glass-soft`, `dd-glass-strong`):** real backdrop-filter. Only for chrome layers where content genuinely passes behind the surface, and bounded in count per viewport.

**Tier 2 — cold glass (`dd-glass-cold`):** identical translucent fill, 1px white border, inset specular top edge, hover sheen — but NO backdrop-filter. Visually near-identical on the dark shell; costs nothing; unlimited use. This is the tier for anything repeated N times.

## Where it applies (Billy wants this everywhere — full coverage)

Tier 1 (live glass):
1. **Report tab bar** — glass pill container with a sliding "lens" active indicator (brighter, lightly blurred, accent-edged; moves with `EASE_RISE` ~300ms). The flagship.
2. **ALL table headers** — every table in the app (player values, full roster rankings, weekly momentum, trending, schedule/admin tables): `dd-glass-soft`, sticky where the table scrolls so rows slide beneath frosted glass.
3. **Position/filter pill groups** — QB/RB/WR/TE/picks filters, value-lens toggles, player-modal inner tabs: glass pills with the sliding lens (cyan lens for navigation, orange for filters).
4. **Section summary bars** — every CollapsibleReportSection header strip becomes glass.
5. **Modals & dialogs** — PlayerDetailModal chrome and ReportDialogs go `dd-glass-strong`.
6. **Hero/spotlight cards** — dashboard spotlight, trade verdict surface, next-move brief: base glass + one-shot specular sheen on hover (sheen replaces the phase-5 `dd-current` on glass surfaces — never both).
7. **Footer control bar** — glass strip.
8. **Grain** — one report-shell-level noise overlay (SVG turbulence data URI, opacity ≤ .05). One layer total.

Tier 2 (cold glass — unlimited):
9. **Player tiles everywhere** — player-team-tile variants, owner-intel tiles, trending/momentum tiles, draft tiles: cold glass with hover sheen + slight lift (translateY(-2px)).
10. **Chips, badges, preview-metric pills** — cold glass fills replacing flat fills where they sit on the shell.
11. **Table rows** stay transparent (they live inside a Tier-1 glass container already); hover keeps the phase-3 row treatment.

Still untouched: the three.js loader/success scenes and AI Tron surfaces (distinct materials by design).

## Replacement mandate (non-negotiable)

Glass REPLACES the old surface styling — it never layers on top:
- Every component that adopts a `dd-glass*` class must have its legacy surface rules (background, border, box-shadow, and any hover variants of those) **deleted in the same diff**, not overridden by specificity.
- Where a legacy class exists only to paint a surface that glass now paints (old tile/card backgrounds), remove the class from markup and delete the rules.
- Net CSS line delta for this phase must be ≤ +150 lines across client/src/styles/ (the glass utility layer is small; the deletions pay for it). Report `git diff --stat` for the styles directory plus a list of every deleted rule block in the result summary.
- The reviewer will reject diffs that add glass via override stacking.

## Engineering constraints

- **Performance budget:** ≤3 backdrop-filter layers in the viewport at once. Mobile (<700px): blur radius halves, or surfaces fall back to solid fills via media query. Verify scrolling stays 60fps on the rankings tab with a performance trace.
- **Fallback:** wrap in `@supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))` — non-supporting browsers keep today's solid surfaces (current look IS the fallback; zero risk).
- **Readability:** text on glass must keep contrast — if any label drops below comfortable reading on the blurred fill, raise that surface's fill opacity rather than changing text colour.
- **Independence from motion gating:** glass is a static material — it stays when animations are off. The lens slide, sheen sweeps, and any movement still gate on `useAnimationsEnabled()`.
- Update `docs/animation-specs/motion-guidelines.md` (from phase 5) with the glass material rules so it stays one design language.

## QA / acceptance criteria

1. `fnm exec --using 24.12.0 pnpm check` + `pnpm test` green, no new failures.
2. Tab bar lens slides between tabs; active tab readable; touch unaffected.
3. Sticky frosted headers on the ranking tables; rows visibly slide under glass.
4. Modals frosted; spotlight cards glass with hover sheen; footer strip glass.
5. Exactly one grain overlay; ≤3 blur layers per viewport; mobile fallback verified at 375px.
6. `@supports` fallback renders today's surfaces untouched.
7. Desktop + mobile screenshots of: overview, rankings table mid-scroll, player modal, tab switch.
