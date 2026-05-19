# Dynasty Degens Brand/UI Redesign Crosswalk

## Working Rules

- Keep the raw ChatGPT kit in `design-inputs/` as a local-only reference.
- Move only shipping assets into `client/public`.
- Preserve current Sleeper username, league picker, league ID, report loading, and tab data flows.
- Preserve existing copy unless a prompt explicitly asks for a wording change or the mockup requires a short UI label.
- Validate desktop, tablet, and mobile before calling a slice done.

## Implementation Order

1. Home pre-login and global brand assets
   - Claude: replace text/header logo, remove weak tagline, improve hero/form/cards.
   - ChatGPT kit: use responsive 3D DD/player hero artwork, header lockup, favicons.
   - App surfaces: `client/src/pages/Home.tsx`, home styles, `client/public/brand`, root favicons.

2. Dashboard chrome/navigation
   - Claude: logo in dashboard header, stronger tab bar, league pills.
   - ChatGPT kit: compact dashboard header and mobile tab references.
   - App surfaces: report header in `Home.tsx`, `report-foundation.css`, `report-surfaces.css`, `report-responsive.css`.

3. Overview tab
   - Claude: sections open by default, section accent bars, stronger previews.
   - ChatGPT kit: Overview desktop/mobile mockups.
   - App surfaces: overview section calls in `Home.tsx`, `ReportTables.tsx`, command/owner components as needed.

4. Rankings tab
   - Claude: reduce value-board header height, position accents, stronger change badges, prospect/archive styling.
   - ChatGPT kit: Rankings desktop/mobile mockups.
   - App surfaces: `RankingsBoard.tsx`, rankings styles.

5. Weekly Momentum tab
   - Claude: signal cards, transaction feed, riser/faller styling, default-open sections.
   - ChatGPT kit: Weekly Momentum desktop/mobile mockups.
   - App surfaces: weekly/report table components and related styles.

6. Trade History tab
   - Claude: roster scanner, calculator, leaderboard, theft detector, ledger badges.
   - ChatGPT kit: Trade History desktop/mobile mockups.
   - App surfaces: trade table components, `TradeWarRoom.tsx`, ledger utilities, styles.

7. Draft History tab
   - Claude: two-column desktop layout, score badges, gap glow, section defaults.
   - ChatGPT kit: Draft History desktop/mobile mockups.
   - App surfaces: draft components in `Home.tsx` and report table styles.

8. Shared player/owner surfaces
   - Claude context: player modal and owner intel are high-density surfaces.
   - ChatGPT kit: Player Detail and Owner Intel desktop/mobile mockups.
   - App surfaces: `PlayerDetailModal.tsx`, owner intel components, shared modal/card styles.

## Validation Notes

- Run `pnpm build` before live review when feasible.
- Use the local preview for visual QA; do not push from this branch.
- Probe at least mobile, tablet, and desktop widths for each completed slice.
