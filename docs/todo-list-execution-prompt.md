# Todo List Execution Prompt

Use this prompt when the user wants to work through `todo.md` item by item:

```text
I’m going to bed. Go through `todo.md` from top to bottom and process every unchecked item.

Rules for tonight:
- If an item is UI, visual, or frontend-polish work, do not implement it tonight. Mark it as deferred for tomorrow and move on.
- For every non-UI item, decide whether it is actionable now or blocked.
- If it is actionable, implement the smallest complete change needed.
- Run the relevant tests or verification for that item when applicable.
- If it is blocked, log exactly why it is blocked and what is needed to unblock it.
- Do not skip ahead permanently. Keep going until you have reviewed every unchecked item.

For each item, report:
- what you changed or logged
- which files changed
- how you verified it
- any follow-up, risk, or deferred UI work
- any new feature ideas or later-stage opportunities that the item suggests

When you are done, return one consolidated report that summarizes every todo item you processed, including:
- implemented changes
- deferred UI items for tomorrow
- blocked items and why
- data or notes we can use later
- new features we can use later

After the full todo list is processed, treat the lower-priority UI and visual items as the next phase of work.

Keep the work practical and production-ready.
Preserve existing behavior unless the item explicitly requires a change.
```

Shorter trigger version:

```text
Go through `todo.md` top to bottom and process every unchecked item. Skip UI work until tomorrow, implement the non-UI items that are actionable, log blocked items, and return one consolidated report at the end.
```

## Site Audit Report

Use this audit as additional context when processing `todo.md`. If a todo item overlaps with one of these findings, treat it as a known follow-up or adjacent opportunity and mention the connection in the report.

# Dynasty Degenerates — Site Audit Report
**League:** Skids Get Beat · **User:** MyNameIsBillex · **Date:** May 12, 2026

---

## 🔴 High Priority — Visible to Users

### 1. "Future Schedule/SOS TODO" label renders in the Autopilot tab
**File:** `client/src/components/AITeamAutopilot.tsx` line 429

The eyebrow label on the schedule section literally reads **"Future Schedule/SOS TODO"** — that raw developer note is visible to anyone who can see the Autopilot tab. Should be replaced with something like "Matchup Planning" or "Strength of Schedule".

```tsx
// Current (bad):
<SectionShell eyebrow="Future Schedule/SOS TODO" title="Matchups come next" icon={CalendarClock}>

// Fix:
<SectionShell eyebrow="Matchup Planning" title="Matchups come next" icon={CalendarClock}>
```

### 2. "Mock data" renders as a visible status badge in Autopilot
**File:** `client/src/components/AITeamAutopilot.tsx` line 360

The "Backend phase" stat in the Autopilot header shows **"Mock data"** as a fallback when `data.dataStatus` is empty. Real users will see this.

```tsx
// Current (bad):
<strong>{data.dataStatus || 'Mock data'}</strong>

// Fix:
<strong>{data.dataStatus || 'Live'}</strong>
```

### 3. "Phase 5 input" visible to users in Autopilot
**File:** `client/src/components/AITeamAutopilot.tsx` line 445

The schedule section shows a badge labeled **"Phase 5 input"** — internal dev phasing language that users shouldn't see. Replace with something meaningful like "Coming soon" or "Offseason".

### 4. Autopilot tab redirects silently when user isn't admin
**File:** `client/src/pages/Home.tsx` lines 4656–4660

If a non-admin user navigates directly to `#autopilot` (as your demo URL does), they get silently redirected to "overview" with no message. The URL you shared points to `#autopilot`, which **MyNameIsBillex will never see** unless the username is listed in `ADMIN_PERMISSIONS` env var. There's no toast, no "access required" message — it just quietly shows Overview instead.

**Impact:** The demo URL you shared is misleading for non-admin users.

**Fix:** Either show a brief "Autopilot is admin-only" toast on redirect, or adjust who gets autopilot access.

### 5. "Trade Market Radar" is buried in the "Weekly Momentum" tab
**File:** `client/src/pages/Home.tsx` line 5533

The **Trade Market Radar** section lives inside `TabsContent value="momentum"` (the "Weekly Momentum" tab). Users looking for trade info will go to the "Trade History" tab and miss it. This feels like a tab placement error — it should either be in the Trades tab or renamed to something that fits momentum context.

### 6. Waiver Intelligence is in "Weekly Momentum" tab, Waiver Claims are in "Trades" tab
**Files:** Home.tsx lines 5568 and 5923

The waiver-related content is split across two different tabs:
- **WaiverIntelligencePanel** → "Weekly Momentum" tab
- **SleeperWaiverClaimsTable** → "Trades" tab (buried inside "Share Hidden Sleeper Data")

This makes it confusing to find all waiver information. Both should be in the same place, ideally a dedicated section or consistently under Trades.

## 🟡 Medium Priority — UX Inconsistencies

### 7. Short tab label "View" for Overview is confusing
**File:** `client/src/pages/Home.tsx` line 5127

On mobile, the Overview tab label abbreviates to **"View"** — which is generic and doesn't convey what the tab is. Compare: Momentum → "Trend", Rankings → "Ranks", Trades → "Trades". "View" gives no hint it's the overview/summary tab. Consider "Overview" or "Sum" or just keeping the icon only on small screens.

### 8. "Monthly Team Blueprint" kicker says "Roster blueprint report" — redundant
**File:** `client/src/pages/Home.tsx` line 5218

The section subtitle for Monthly Team Blueprint is `"Roster blueprint report"` which just restates the title. Should be something descriptive like `"Personalized roster health, market signals, and action plan"`.

### 9. `alt=""` on decorative but potentially meaningful images
**File:** `client/src/pages/Home.tsx` lines 325, 531, 2119, 2191, 2251

Several `<img>` tags that show player avatars or league logos have `alt=""`. This is fine for purely decorative images, but avatar images alongside manager names should have descriptive alt text (e.g., `alt={manager + " avatar"}`).

### 10. "History: Partial" shown as a warning in Monthly Blueprint preview metrics
**File:** `client/src/pages/Home.tsx` lines 5237–5241

When `weeklyRisers` has data, the preview chip shows **"History: Partial"** with a `warn` tone (orange/yellow). This is likely fine data, not actually a warning condition. The logic seems inverted:

```tsx
// Current (inverted logic):
tone: reportData.weeklyRisers?.length ? "warn" : "neutral"

// Should probably be:
tone: reportData.weeklyRisers?.length ? "info" : "warn"
```

### 11. `leaguePreview.test.ts` exists but `leaguePreview.ts` does not
**File:** `server/leaguePreview.test.ts`

There's a test file for `leaguePreview` but no corresponding implementation file in the server directory. The test file likely has dead imports or skipped tests — worth auditing before this confuses future contributors.

```bash
ls server/leaguePreview* # Only .test.ts exists
```

### 12. Admin section headers say "Admin Eyes Only" in plain text
**File:** `client/src/pages/Home.tsx` lines 3397, 5942

The collapsible sections titled **"Admin Eyes Only: Value Assumptions"** and **"Admin Eyes Only: Open Trade Offers"** use `canViewAdminFeatureExpansion` to conditionally render — so regular users won't see them. But the raw label text isn't very polished even for admin use. Consider something like "Value Source Configuration" and "Pending Trade Offers".

## 🟢 Low Priority / Code Quality

### 13. `projections` → `rankings` tab migration has leftover alias code
**File:** `client/src/pages/Home.tsx` line 4652

There's a tab migration alias still in place:
```tsx
const migratedActiveTab = activeTab === "projections" ? "rankings" : activeTab;
```
If the "projections" tab has been fully removed and URLs have been updated, this alias can be cleaned up. If old bookmarks need to still work, it's fine but should be documented.

### 14. `console.log` left in ComponentShowcase
**File:** `client/src/pages/ComponentShowcase.tsx` line 197
```tsx
console.log("Dialog submitted with value:", dialogInput);
```
Remove before production builds — though this file may only be a dev/showcase page.

### 15. Server `console.warn` / `console.error` pattern is inconsistent
**Files:** Multiple server files

The server uses a mix of `console.warn`, `console.error`, and `console.log`. Ideally this would use a structured logger (like Pino or a shared logger module) for consistent log levels, formatting, and production filtering. Currently some `console.log`s in `exportLoginAttempts.ts` would fire in production.

### 16. `FLEAFLICKER_LEAGUE_ID` and `FLEAFLICKER_SEASON` env vars feel manual
**File:** `.env.example`

These two vars require manually updating the season year every year. Consider deriving the season from the current date or from Sleeper's season context to reduce maintenance toil.

## ✅ Things That Look Correct

- Tab routing + URL sync logic is solid (hash-based, with proper `replaceState`)
- The `canViewAdminFeatureExpansion` guard is applied consistently to admin sections
- Null guards (`|| {}`, `|| []`, `?.`) are used consistently on optional report data
- Lazy loading on all heavy components is properly implemented
- The `ErrorBoundary` component exists and is imported
- `as any` usages are isolated to browser event edge cases in UI primitives (not business logic)
- Type definitions in `shared/types.ts` correctly mark optional fields with `?`
- KTC snapshot files are up to date through May 2026

## Visual & UX Audit

Use this audit as additional context when processing `todo.md`. Treat items here as frontend/UX follow-ups, and defer implementation until tomorrow unless the user explicitly asks to handle UI work now.

# Dynasty Degenerates — Visual & UX Audit
**Focus:** Alignment, visibility, viewport issues, and user experience
**Date:** May 13, 2026

---

## 🔴 High Priority — Likely Broken or Noticeably Wrong

### 1. Sticky table headers use a hardcoded `top: 5rem` fallback — may clip under the nav on some viewports
**File:** `report-responsive.css`

```css
top: var(--report-sticky-offset, 5rem);
```
If the real header is taller or shorter than 5rem (likely on mobile where tabs wrap), sticky row headers in the Rankings board and rookie draft table will either hide behind the nav or float with a gap above them. The `--report-sticky-offset` variable needs to be set dynamically from JS to match actual rendered header height.

### 2. Rankings toolbar has 5+ conflicting grid definitions with `!important` — likely breaks on tablet (768–1100px)
**File:** `report-responsive.css`

The `.value-board__toolbar` grid is redefined five separate times across breakpoints. Between 768px and 1100px there are three competing definitions. On an 820–900px screen, position filter buttons may wrap onto extra rows unexpectedly, creating a tall, misaligned toolbar. Test at 820px and 1024px specifically.

### 3. On mobile, the value score uses `position: absolute` — can overlap player names on sub-375px screens
**File:** `report-responsive.css`

Player name columns use `padding-right: 8–9rem` to avoid overlap with the absolutely-positioned score/rank stack. At 320px (older iPhones, small Androids), long names like "De'Von Achane" will be severely truncated or fully hidden. Test at 320px — consider hiding one data point on very narrow screens.

### 4. Draft Buzz position grid collapses to 1 column on mobile — creates an extremely long scroll
**File:** `report-responsive.css`

The 4-column `QB / RB / WR / TE` layout on desktop becomes 1 column on mobile. With 5–8 players per position, users scroll through 20–32 stacked cards with no visual grouping. A 2-column mobile layout would be significantly more scannable.

### 5. Trade ledger table's `display: block` year-row wrapper around CSS grid children can cause horizontal overflow
**File:** `report-responsive.css`

At `max-width: 767px`, `.trade-year-row` becomes `display: block` but its children (trade rows) are CSS grid. A block container around grid items can result in children exceeding container width in some browsers, causing a horizontal scrollbar on the Trades tab.

### 6. Manager modal metric tiles on mobile have a `min(4rem, 100%)` minimum — produces near-invisible text at 6+ metrics
**File:** `report-responsive.css`

```css
grid-template-columns: repeat(auto-fit, minmax(min(4rem, 100%), 1fr)) !important;
```
At 4rem wide, the label `font-size: clamp(0.4rem, 1.5vw, 0.52rem)` on a 390px phone = roughly 6px text — unreadable. Minimum tile width should be `5.5rem–6rem`.

## 🟡 Medium Priority — UX Friction or Visual Inconsistency

### 7. Active tab slider position depends on tab count class — wrong if Autopilot tab renders without updating the count class
**File:** `report-responsive.css`

```css
left: calc((100% / var(--dd-report-tab-count)) * var(--dd-report-tab-index) + 0.24rem);
```
The orange slider requires both `--dd-report-tab-count` and `--dd-report-tab-index` to match. If the admin Autopilot tab renders conditionally but the `.report-tabs-five` class isn't applied, the slider lands on the wrong tab. Validate this path when `canViewAutopilotTab` is true.

### 8. AI card neural surface runs 6 simultaneous animations on every card — may cause jank on older phones
**Files:** `ai-autopilot.css`, `report-responsive.css`

Each `.ai-neural-surface` runs `ai-grid-drift`, `ai-data-packet-vertical`, `ai-line-surge`, `ai-data-packet-horizontal`, `ai-node-flicker`, and `ai-border-breathe` simultaneously. The `prefers-reduced-motion` guard is present, but there's no `prefers-reduced-data` or low-end device guard. On older Android phones, these may cause visible frame dropping even without the motion preference set.

### 9. Blueprint grade grid forces 6 columns with no intermediate breakpoint between 760px and 1080px
**File:** `report-responsive.css`

`.team-blueprint-grades-panel` uses `repeat(6, minmax(0, 1fr))` at all widths above 760px. At 900px, each tile is ~135px — note text inside gets truncated. A 3-column intermediate at 768–1080px would help.

### 10. Trade fairness AI text is clamped to 2 lines on mobile with no "read more" affordance
**File:** `report-responsive.css`

```css
.trade-fairness-card p { -webkit-line-clamp: 2; }
```
Mobile users see a truncated trade analysis with no indication more text exists and no way to expand it. Desktop users see the full analysis. A disclosure toggle or "Read more" link would fix this.

### 11. Trend pill and movement pill have different min-widths — right rail looks misaligned
**File:** `report-responsive.css`

Trend pill: `min-width: 3.85rem`. Movement pill: no explicit min-width. The two adjacent columns in the rankings right rail appear different widths even when showing similar-length content, making the right rail look uneven. Aligning both to the same `min-width` would help.

### 12. `.value-board__market-values` is globally hidden with `display: none !important`
**File:** `report-responsive.css`

```css
.value-board__market-values { display: none !important; }
```
This silently hides all market value source pills. If intentional (replaced by the simpler value display), the associated dead CSS from multi-source pill rendering should be cleaned up. If unintentional, data users expect to see is invisible.

### 13. The blueprint gauge arc uses `border-bottom` for its baseline — renders differently in Firefox
**File:** `report-responsive.css`

The CSS semi-circle gauge uses `border-bottom + border-radius` which Firefox renders slightly differently than Chrome/Safari. The gauge baseline may appear offset or thicker. An SVG arc would be more reliable across browsers.

### 14. Player images use `object-fit: contain` with `drop-shadow` — shadow becomes a rectangle for players with colored backgrounds
**File:** `report-responsive.css`

```css
filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.44));
object-fit: contain;
```
`drop-shadow` correctly traces transparent PNG silhouettes, but older ESPN/NFL player images with colored backgrounds show a rectangular drop shadow instead. This looks broken and inconsistent across the player roster.

## 🟢 Low Priority / Polish

### 15. Admin premium section runs two simultaneous pseudo-element animations — may cause color banding on mid-range mobile GPUs
**File:** `report-responsive.css`

`::before` runs `dd-admin-solar-field` and `::after` runs `dd-admin-solar-sweep` simultaneously across the full summary surface. On Snapdragon 7xx-era mobile GPUs, two full-surface background-position animations can produce visible frame drops or color banding.

### 16. At `max-width: 430px`, every analysis preview chip becomes full-width — collapsed sections become very tall on small phones
**File:** `report-responsive.css`

```css
.analysis-preview-chip { flex-basis: 100%; }
```
A section that shows 4 compact side-by-side chips on tablet becomes 4 full-width stacked chips on a 390px phone. The page feels very long even before any sections are opened. The 2-per-row pattern used by `report-disclosure-preview-row-has-icons` is better — consider applying it universally.

### 17. `overflow: clip` on collapsible body during animation clips tooltips/popovers inside
**File:** `report-responsive.css`

```css
.report-disclosure[open] .report-disclosure-body { overflow: clip; }
```
Any tooltip or dropdown that opens during the expand animation gets clipped. After animation ends, overflow likely resets — but a quick tap immediately after opening a section will cut off any popover. Consider `overflow: hidden` + `clip-path` instead, or only applying `overflow: clip` for the animation duration.

### 18. Home page avatar stacks use inline `z-index: index + 1` — values above 9 can conflict with dropdown/modal overlays
**File:** `client/src/pages/Home.tsx` lines 2186, 2241

League shortcut avatar stacks increment z-index from 1 upward. A league with 10+ members creates z-index 10+ avatars that can appear on top of open dropdown menus (shadcn/Tailwind z-10 to z-50 range). Cap the z-index at 8 and use `isolation: isolate` on the avatar stack container instead.

## ✅ Things That Look Good

- `prefers-reduced-motion` is applied comprehensively to all animation types — solid accessibility
- Team color CSS custom properties (`--team-primary`, `--team-accent`) are consistent throughout
- Font sizing uses `clamp()` everywhere — no hard pixel jumps between breakpoints
- The orange tab indicator slide animation works well and is a nice interactive touch
- Mobile trade ledger (card layout vs table) is a good pattern for dense tabular data on small screens
- `interactive-identity` hover scale effects on avatars are subtle and polished
- `@media (hover: none)` fallback correctly uses `:active` instead of `:hover` for touch devices
- The devy prospect mobile layout (buzz score top-right, traits bottom) is well thought out for scanning
- `drop-shadow` on transparent player PNGs (when images are actually transparent) looks great
