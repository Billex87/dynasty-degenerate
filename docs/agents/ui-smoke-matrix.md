# Dynasty Degens UI Smoke Matrix

Use this matrix for visual UI/UX QA, final checks, and frontend completion claims. It complements `docs/report-ui-qa-checklist.md` and `docs/manual-qa-checklist.md`.

## Default Viewports

- Mobile: `390x844`
- Tablet: `834x1194`
- Desktop: `1440x1000`

For small fixes, check the touched surface plus one mobile viewport. For broad UI work, check all three.

## Core Surfaces

| Surface | Route or Setup | Checks |
| --- | --- | --- |
| Signed-out home | `/` with no active report | Hero crop, logo, title wrapping, CTA spacing, support button wrapping, feature-card carousel behavior, footer/legal links. |
| League lookup and picker | `/` | Sleeper username lookup, league ID fallback if visible, league picker/history rows, loading and error states. |
| Loading report state | `/?preview=loading` | Manager anchors, fallback avatars, progress copy, no washed-out transparent logos, no distracting glow/noise. |
| Loader kit preview | `/loader-kit-preview` | Orbit readability, manager anchors, logo treatment, desktop/mobile framing. |
| Report overview | generated report on `/` | Header, tabs, report hero, Owner Intel, Cross League Exposure, manager/view-as controls, no duplicate labels. |
| Rankings | generated report, Rankings tab | Full Roster Rankings, College Rankings, Prospect Score Archive, identity cells, missing images, sorting, mobile overflow. |
| Momentum | generated report, Momentum tab | Weekly Momentum, value-change copy, old-to-new values, Recent Transactions, no duplicate Better Cut guidance. |
| Trades | generated report, Trades tab | Trade War Room, manager-grouped pending cards, `Sends` treatment, claims/drops, FAAB pill placement, no duplicate FAAB text. |
| Draft | generated report, Draft tab | DraftBuzz scoreboards, ADP chips, rookie/startup views, dense-table mobile wrapping. |
| Waivers | generated report, waiver/command sections | Waiver intelligence, add/drop guidance, K/DEF treatment, player identity rows, evidence receipts. |
| Player detail modal | any player row | Modal fit, close controls, accessible name, Cross-Position Trade Comps, images/fallbacks, mobile scroll. |
| Admin diagnostics | admin-unlocked local state | Source coverage, provider diagnostics, protected controls, no secrets, provider names allowed only on diagnostics/admin/legal surfaces. |
| Component showcase | `/components` | Shared UI primitives after token/global style changes. |
| Legal/support pages | `/terms`, `/privacy`, `/refunds`, `/data-disclosures`, `/services`, `/support`, `/sleeper-helper` | Headings, footer links, mobile line length, route fallback behavior. |
| Not found | `/404` and an unknown route | SPA fallback, no framework overlay, correct 404 content. |

## Visual Audit Checklist

- Typography scale: headings, body, labels, chips, buttons, table cells, chart labels, modal text.
- Spacing and hierarchy: enough separation between dense panels without card-within-card clutter.
- Wrapping and clipping: no truncated labels, overlapping chips, horizontal overflow, or hidden close controls.
- Responsive behavior: intentional carousels remain usable; real grids/tables do not overflow accidentally.
- Loading and error states: meaningful copy, no stale spinner-only states, no missing assets.
- Accessibility basics: focus visible, icon-only buttons named, modals trap/restore focus when practical.
- Console health: no relevant Vite/React/runtime errors or unexplained warnings.
- Product copy policy: recommendation and AI read copy stays blend-first and avoids provider-branded labels unless on diagnostics/admin/legal surfaces.

## Useful Commands

```bash
pnpm run audit:ui
pnpm run validate:report
pnpm run check
pnpm test
pnpm build
pnpm run test:e2e
git diff --check
```

Use the lightest command that matches the risk. Rendered UI evidence is still required for meaningful visual changes.

## Evidence Standard

For UI changes, final status should name:

- URL or route checked
- viewport sizes checked
- Browser or Playwright path used
- screenshot evidence captured or blocker
- interaction path exercised
- relevant console errors or warnings
- anything intentionally not checked
