# Dynasty Degens Motion And Material Guidelines

This app is a Vite/React single-page report experience. Motion and material should make the product feel fast, precise, and report-native without competing with the data. Phase 8 makes this the full-app design language: report, home, dialogs, Sleeper helper, legal/404, and low-touch admin surfaces share the same tokens and interaction vocabulary.

## Source Of Truth

- Framer Motion imports belong only in `client/src/lib/motion`.
- CSS motion and material tokens live in `client/src/styles/premium-tokens.css`.
- Shared React motion helpers live in `client/src/lib/motion`.
- Shared glass, scrollbar, selection, focus, and material values must be token-driven. Do not copy hardcoded glass `rgba(...)`, blur radii, grain images, or scrollbar colors into feature files.
- Report-level micro-interactions live in the existing report CSS stack. Do not add another animation system.

## Materials

Use the material classes directly instead of rebuilding surfaces per component:

- `.dd-glass`: live glass for normal chrome layers where content can pass behind the surface.
- `.dd-glass-soft`: lower-blur live glass for small chrome and compact controls.
- `.dd-glass-strong`: stronger live glass for dialogs, modal chrome, and prominent panels.
- `.dd-glass-cold`: non-blur cold glass for repeated cards, rows, chips, pills, and tile grids.

Rules:

- Live glass is allowed to use `backdrop-filter`; cold glass must not.
- A normal viewport should not show more than three live blur layers at once.
- Repeated rows/cards should use cold glass to avoid blur cost and visual mush.
- Home analyze cards, league cards, portfolio rows, recent-entry chips, feature cards, Sleeper helper panels, legal cards, and 404 cards should read as the same cold/live glass family as the report.
- Admin/diagnostic surfaces prioritize function: tokenized scrollbars, focus rings, tabular numerals, and restrained material only.
- Glass surfaces do not use `.dd-current` or `.dd-current-line`; use hover lift, sheen, or border-current only on controls where it improves affordance.

## Motion Vocabulary

Use shared duration tokens before adding timings:

- `--dd-duration-press`: 60ms for active press feedback.
- `--dd-duration-fast`: 180ms for hover and small state changes.
- `--dd-duration-base`: 320ms for normal reveals.
- `--dd-duration-settle`: 450ms for section and kicker reveals.
- `--dd-duration-current`: 550ms for one-shot border-current or glass-sheen hovers.
- `--dd-duration-ring`: 700ms for manager trend rings.
- `--dd-duration-blip`: 900ms for live data blips.

Use shared easings unless a motion primitive has a documented reason:

- `--dd-ease-rise`: normal polished entrance/exit.
- `--dd-ease-overshoot`: press release and small elastic returns.
- `--dd-ease-pop`: short emphasis, current lines, ring sweeps, and sheen passes.

## Interaction Rules

- Prefer one-shot emphasis over infinite animation.
- Infinite motion is reserved for loading states, live status, and intentionally ambient report surfaces.
- Keep one hero motion moment per surface. Supporting cards should use smaller reveal, blip, or current-line treatments.
- Press feedback should be transform-only through `.dd-pressable` and `--dd-duration-press`.
- Hover effects should not shift layout. Use transform, opacity, border color, or shadow.
- Live value movement should use `useValueBlip`; do not hand-roll counters.
- Manager avatar rings must use real report data. If the input delta is missing, zero, or synthetic, render the avatar normally.
- Cursor-reactive grids must be pointer-fine only, rAF-throttled CSS variable writes, and zero React re-renders.

## Chrome Standards

- Focus-visible language: 2px cyan outline, 2px offset, and `--dd-focus-ring` shadow.
- Scrollbars: 8px, rounded, translucent cyan thumb, near-invisible track, Firefox `scrollbar-width: thin`.
- Selection: cyan selection with dark text through `--dd-selection-bg` and `--dd-selection-color`.
- Horizontal rails: use `.dd-edge-fade-rail` instead of hard clipping when overflow is intentional.
- Dialogs and pickers outside the report use `.dd-glass-strong`, tokenized focus rings, and pressable actions.
- Small report loading indicators use `ReportMicroLoader`; the main league loading scene remains separate.
- Tooltips on report data controls should use `ReportTooltip`. Avoid bare `title=` for report value chips, rank badges, trend rings, FAAB ranges, or compact data controls.

## Surface Application

- Report shell: full motion system, live/cold glass, reading beams, skeletons, tooltips, current-line hovers, tabular numerals.
- Home signed-out: brand hero type stays intact; analyze form and inputs use glass; CTAs use press physics; feature carousel uses cold glass cards and edge fade.
- Home signed-in portfolio: picker cards, portfolio panel, rows, chips, filters, and empty/loading states use report-aligned glass and tabular numerals.
- Home dialogs and league switcher: strong glass, focus-visible ring, machined scrollbars, pressable actions.
- SleeperHelper: static page, glass panels, tokenized scrollbars/focus, tabular numerals where counts or steps appear.
- Legal and NotFound: one calm glass content card, typography polish, selection/scrollbars, no decorative motion beyond entrance.
- Admin and diagnostics: function over flair; use tokens, scrollbars, focus rings, and tabular numerals. Avoid added animation.

## Gating Contract

- React motion must check `useAnimationsEnabled()`.
- Report shells expose effective state with `data-dd-effects="on"` or `"off"`.
- Persisted user preference is `dd-reduce-effects` in `localStorage`; OS reduced-motion still wins.
- CSS hover motion should use `(hover: hover) and (pointer: fine)` when it depends on pointer precision.
- Effects-off CSS should show final readable states, not hidden or half-entered states.
- Native `document.startViewTransition` is progressive only. Gate it with `useAnimationsEnabled()`, feature-detect it, and suppress phase-2 tab enter while a native view transition is active.

## Current Primitives

- `MotionReveal`, `Stagger`, and `Flip` wrap Framer Motion behind the import boundary.
- `useValueBlip` emits transient numeric deltas for dashboard and ranking values.
- `useCursorReactiveGrid` writes `--dd-cursor-x` and `--dd-cursor-y` directly to the shell.
- `useScrollProgressBeam` writes `--dd-reading-progress` directly to the report shell or modal scroller; it uses passive scroll listeners and no React state updates.
- `ManagerTrendAvatar` renders real-data trend rings around manager avatars.
- `.dd-current` plus `.dd-current-line` provides the border-current hover signature for report controls.
- `.dd-pressable` provides shared press physics outside and inside report surfaces.
- `.report-section-kicker-wrap` and `.report-section-kicker-rule` provide section kicker reveals.
- `ReportTooltip`, `ReportSkeleton`, and `ReportMicroLoader` are shared fit-and-finish primitives for report chrome.

## Number Formatting

- Use full precision with separators in tables, source receipts, row details, and tooltips: `48,210`.
- Use compact labels in tiles, headlines, and cramped badges where scan speed matters: `48.2K`.
- Keep stat, value, rank, score, count-up, and odometer surfaces on tabular numerals so animated and sorted values do not wobble.
- When a compact value is shown, keep the full value available in nearby detail copy, table rows, receipts, or tooltip content.

## Exclusions

Do not converge these during normal visual-layer passes:

- Loading scene.
- Success takeover/card.
- `LoaderKitBackdrop`.
- AI Tron surfaces and `AITronSurface`.
- Server, data, routing, provider policy, report calculations, and copy.

These surfaces are distinct material workstreams. Any changes need an explicit task and separate verification.

## Governance

- Visual-layer passes must not change behavior, routing, copy, server code, provider policy, or data transforms.
- When replacing motion, remove the legacy rule in the same diff.
- Before deleting selectors or keyframes, prove they have no source references or are superseded by later same-surface rules, then list the removal evidence in the result.
- Do not add animation dependencies without explicit justification.
- Keep `client/src/styles` at or below the pre-roadmap baseline when the phase requires CSS shrink.
- Browser/screenshot review is required for meaningful frontend completion claims unless the sandbox or user explicitly rules it out.
