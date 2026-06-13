# Phase 9 — AI Tron surface upgrade (circuit board fidelity)

Status: ready
Designer/reviewer: Claude · Implementer: Codex
Scope confirmed by Billy (2026-06-12): bring the AI readout panels up to the high-fidelity circuit-board reference. Three approved gap areas — **circuit routing & nodes**, **panel surfaces**, **icons & typography**. NOT recoloring: keep the existing cyan (#35dfff/#7df7ff) + orange (#ffb45a) hues exactly.

Files: `client/src/components/AITronSurface.tsx` (537 lines, generates the circuit board), `client/src/styles/ai-tron-surface.css` (1819 lines, panel surfaces), `client/src/components/AIReadPanel.tsx` (panel header icons/labels). The phase-4 typewriter CSS now lives in report-surfaces.css, so editing ai-tron-surface.css is safe again.

## Verified current state (reviewed live on the real-league report)
- Circuit traces render but are faint, sparse, low-opacity (board routes opacity ~0.43–0.52, stroke width ~0.32–0.38) and use straight `L` segments in `pathFromPoints`, producing DIAGONAL runs. Nodes are tiny (r 0.1–0.22, opacity 0.14–0.42) and barely visible.
- AI panels (`.ai-surface-r3f`, `.ai-neural-surface-*`) are flat dark cards with a faint border — no glass material, square-ish corners.
- Header icons are small/quiet.

## Reference target
Bright, deliberate PCB routing visibly threading the gutters between panels; orthogonal (right-angle) traces with rounded corners; glowing solder-node junctions; frosted-glass panels with crisp tech-framed (notched/cut-corner) edges; prominent per-panel tech icons.

## Work

### 1. Circuit routing & nodes (`AITronSurface.tsx`)
- **Orthogonal routing:** change `pathFromPoints` (and/or the node arrays in `makeBoardRoute`) so traces run as Manhattan routes — horizontal and vertical segments only, no diagonals — with small rounded corners at each bend (e.g. emit `L` into the corner then a short quadratic/arc to round it, ~0.6–1.0 unit radius). This is the single biggest fidelity lever.
- **More present, still tasteful:** raise board-route opacity/width modestly so the routing reads clearly as a circuit board WITHOUT becoming loud (keep it behind the panels in the gutters). Bias routes to run in the spaces between panel cards.
- **Solder nodes:** brighten and enlarge junction/endpoint nodes — a colored core + white hot-center + soft glow halo at each bend and terminus, so junctions read as solder points like the reference. Hero routes get the brightest nodes.
- Keep the existing animated packet/particle flow; keep all hues unchanged. Respect reduced motion (existing pattern).

### 2. Panel surfaces (`ai-tron-surface.css`)
- Apply the phase-6 glass material to the AI panels: convert `.ai-surface-r3f` / `.ai-neural-surface-*` card backgrounds to the `dd-glass` recipe (translucent fill + backdrop blur + saturate + inset specular top edge) so panels read as frosted glass sitting ON the circuitry. Keep per-variant accent edges (core/risk/draft/etc.) but source them from the variant's existing tone.
- **Tech-framed corners:** give panels the notched/cut-corner frame from the reference (e.g. `clip-path` polygon with clipped top-right + bottom-left corners, plus a 1px accent border that follows the notch). Keep it subtle and consistent across all panels.
- REPLACE, don't layer: delete the superseded flat-card background/border/shadow rules in the same diff. Report net styles line delta.
- `@supports` fallback: where backdrop-filter is unsupported, fall back to the current solid panel surface.

### 3. Icons & typography (`AIReadPanel.tsx` + css)
- Enlarge and sharpen the per-panel header icons (the `getAIReadIcon` lockup) so each panel has a crisp, prominent tech glyph like the reference; give the icon a small glass/circuit chip backing consistent with the panel material.
- Tighten the kicker/label typography to match the reference: confident uppercase, slightly wider tracking, clear hierarchy between the icon-label row and the body. Use existing type tokens; no new fonts.

## Constraints
- Cyan/orange hues unchanged. No new dependencies. Motion gated on existing reduced-motion handling.
- EXCLUDED still: loader/success scenes, LoaderKitBackdrop — do not touch.
- `fnm exec --using 24.12.0` `pnpm check` + `pnpm test` green, no new failures.
- Report net `client/src/styles/` line delta and confirm the styles total stays at/below the 64,698 baseline (or note the small increase if the glass/frame additions require it — deletions of the old flat-card rules should largely offset).

## QA / acceptance
1. Checks + tests green.
2. Orthogonal routing with rounded corners and bright solder nodes — visibly a circuit board, still behind/around the panels.
3. Panels are frosted glass with notched tech-frame corners; flat-card rules deleted.
4. Header icons prominent and crisp; labels tightened.
5. Hues unchanged; reduced-motion still calm.
6. Reviewer verifies against the reference on the real-league report (Owner Intel Lab AI panels) via screenshot.
