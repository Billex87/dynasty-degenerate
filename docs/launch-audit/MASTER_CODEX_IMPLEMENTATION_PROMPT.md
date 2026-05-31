# Master Codex Implementation Prompt – Dynasty Degens

## 1. Context

You are an implementation agent for Dynasty Degens, a fantasy football analytics platform that integrates with Sleeper leagues.  A deep launch‑readiness audit has been performed on the live app using the Sleeper username **mynameisbillex**.  The audit identified numerous issues, particularly with league selection, cross‑league logic, UI/UX, accessibility and responsiveness.  Only the **Skids Get Beat** league (Dynasty, Superflex, Half‑PPR) was accessible during the audit due to a bug.  Other leagues (**The Fantasy Degenerates**, **test league** and **Gov Tech Grid Iron**) could not be loaded, so many behaviours remain unverified.  

You must read all audit documents provided in this folder (e.g., `EXECUTIVE_LAUNCH_READINESS_SUMMARY.md`, `SITE_MAP_AND_CLICK_INVENTORY.md`, `LEAGUE_CONTEXT_AND_BUSINESS_LOGIC_AUDIT.md`, `CROSS_LEAGUE_VALIDATION_MATRIX.md`, `FULL_UI_UX_AUDIT.md`, `TABLES_AND_DATA_DENSITY_AUDIT.md`, `PLAYER_DETAIL_MODAL_AUDIT.md`, `RESPONSIVE_AND_MOBILE_AUDIT.md`, `ACCESSIBILITY_AUDIT.md`, `VISUAL_SYSTEM_CONSISTENCY_AUDIT.md`, `FANTASY_FOOTBALL_PRODUCT_WORKFLOW_AUDIT.md`, `EMPTY_LOADING_ERROR_STATE_AUDIT.md`, `RELEASE_RISK_REGISTER.md`, `LAUNCH_QA_CHECKLIST.md`) before making any changes.  These documents describe the current behaviours, issues, and recommendations.

## 2. Goals

1. **Fix league selection and switching** – Ensure users can choose any of their leagues at any time.  Remove the automatic league reload.  Provide a reliable league selection modal accessible from all pages.  The progress overlay must finish or fail gracefully.
2. **Implement league‑specific logic** – Adapt UI, rankings, values and projections based on league settings (dynasty vs redraft, superflex vs one‑QB, TE premium vs non‑premium, draft status).  Use the league’s scoring settings from Sleeper to adjust player values and metrics.
3. **Improve loading, empty and error states** – Provide clear messaging, retry/cancel options and accessible progress announcements.  Avoid indefinite loading.  Offer helpful empty states for pre‑draft or no‑data situations.
4. **Enhance tables and player modals** – Make the Full Roster Rankings table discoverable, sortable and responsive.  Improve the player modal’s usability (add close button, clarify metrics, add cross‑position comps interaction).  Ensure all components adapt to league context (e.g., TE premium indicator).
5. **Improve UI/UX and visual consistency** – Standardise tabs, buttons, badges, typography, colours and spacing.  Reduce comedic copy where it undermines trust.  Provide a design‑system approach using tokens.  Keep the product dense but readable.
6. **Make the app responsive** – Ensure all major pages, tables, and modals work on laptop, tablet and phone viewports.  Implement sticky player columns, collapsible cards or horizontal scroll as appropriate.
7. **Address accessibility** – Implement keyboard navigation, visible focus states, ARIA labels, sufficient contrast, accessible forms and modals.  Ensure screen reader users can navigate the app and understand value changes without relying on colour.

## 3. Non‑goals

- Do not redesign the app from scratch.  Keep the existing brand aesthetic (dark sports theme) and humour where appropriate.
- Do not modify backend APIs or data models unless necessary to fetch league settings.  Use existing endpoints when possible.
- Do not add new features outside the scope of the audit recommendations (e.g., gambling functionality).  Focus on issues identified as launch blockers or high severity.

## 4. Source documents to read

- `EXECUTIVE_LAUNCH_READINESS_SUMMARY.md` – high‑level overview and key recommendations.
- `SITE_MAP_AND_CLICK_INVENTORY.md` – inventory of pages, interactions and click behaviour.
- `LEAGUE_CONTEXT_AND_BUSINESS_LOGIC_AUDIT.md` – describes expected vs observed behaviours per league.
- `CROSS_LEAGUE_VALIDATION_MATRIX.md` – summarises differences expected across leagues; many remain unverified.
- `FULL_UI_UX_AUDIT.md` – lists UI issues with IDs and severity.
- `TABLES_AND_DATA_DENSITY_AUDIT.md` – analyses the Full Roster Rankings table and recommends improvements.
- `PLAYER_DETAIL_MODAL_AUDIT.md` – analyses the player modal and recommends improvements.
- `RESPONSIVE_AND_MOBILE_AUDIT.md` – outlines responsive strategies and mobile breakpoints.
- `ACCESSIBILITY_AUDIT.md` – lists accessibility issues with IDs and fixes.
- `VISUAL_SYSTEM_CONSISTENCY_AUDIT.md` – identifies design inconsistencies and recommends standards.
- `FANTASY_FOOTBALL_PRODUCT_WORKFLOW_AUDIT.md` – analyses common workflows and friction points.
- `EMPTY_LOADING_ERROR_STATE_AUDIT.md` – critiques loading and empty/error states.
- `RELEASE_RISK_REGISTER.md` – ranks risks and indicates which are launch blockers.
- `LAUNCH_QA_CHECKLIST.md` – describes QA checks to pass after implementation.

## 5. Priority order

1. **League switching and state persistence** (address R‑001, UI‑001, UI‑002).  Without this, nothing else can be tested.
2. **League‑specific logic (dynasty/redraft, superflex, TE premium, draft status)** (R‑002 to R‑004).  This includes adding TE premium tags and adjusting projections.
3. **Improve loading overlay, empty states and error handling** (UI‑002, Empty state recommendations, A11y‑007).
4. **Accessibility fixes** (A11y‑001 to A11y‑006) and UI clarity improvements (UI‑003 to UI‑012).
5. **Table improvements and player modal enhancements** (TABLES audit, PM‑001 to PM‑007).
6. **Responsive and visual consistency updates** (Responsive audit, VISUAL audit).
7. **Performance and minor polish** (microcopy, icon consistency, optional features).

## 6. Detailed implementation scope

### 6.1 League switching and persistence

- Remove or modify the logic that automatically reloads the last league when visiting `dynastydegens.com`.  Instead, direct users to the landing page or the last selected league only if there is a valid flag (e.g., `rememberLeague`).  Provide a “Clear saved league” option.
- Ensure the `Switch League` button is implemented as an accessible `<button>` element.  When clicked, it should open the league selection modal listing all of the user’s leagues with avatars and names.  Use existing API calls to fetch the list.  Remember to close the modal when a league is selected.
- Implement proper loading state: show a progress indicator with serious messaging (e.g., “Fetching league data…”).  If the data takes more than 10 seconds, show an error message with a retry option.
- Store the selected league in a safe manner (e.g., session storage) and allow users to change it.  Avoid locking the UI if network requests fail.

### 6.2 League‑specific logic

For each league, use the Sleeper API (e.g., `https://api.sleeper.app/v1/league/<league_id>`) to fetch settings.  From the response, derive the following:

- `season_type` and `status` to determine draft status (pre‑draft, drafting, in season, completed).
- `scoring_settings` to detect TE premium (e.g., `te_recption` > `recption`), half PPR vs PPR, etc.
- `roster_positions` to detect superflex (presence of `SUPER_FLEX` or an extra QB slot) and team sizes.

Use this information to drive UI and value logic:

- **Dynasty vs redraft**: Use dynasty values and long‑term metrics only in dynasty leagues.  In redraft leagues, hide dynasty metrics, emphasise current‑season projections and weekly rankings, and remove references to taxi squads or rebuild/contend labels.
- **Superflex**: Boost QB rankings and values in superflex leagues.  In one‑QB leagues, adjust QBs down accordingly.  Display an `SF` badge in the header for superflex leagues.
- **TE premium**: Multiply TE projected points by the premium (e.g., 1.5× for receptions).  Raise TE dynasty values accordingly.  Display a `TE Premium` badge in the header and in player modals.
- **Draft status**: If `status` is `pre_draft` or `drafting`, hide or disable roster‑dependent features (e.g., team analysis, trade receipts).  Show a pre‑draft empty state explaining the draft has not completed.  Once `status` is `complete` or `in_season`, display roster analysis and trade history.

### 6.3 Loading, empty and error states

- Replace the current comedic loading overlay with a serious progress indicator.  Provide humorous text as secondary copy, but ensure the primary message explains what is happening.
- Add a timeout (e.g., 10 s).  If the API call fails or times out, show an error card with a retry button and a link to contact support.
- Create component‑level error boundaries: each section (Overview, Momentum, Rankings, etc.) should catch its own API errors and show an error message instead of rendering nothing.
- Implement empty state components: when there is no data (e.g., search returns zero results, pre‑draft rosters), display a message explaining why and suggesting next steps.  Use icons and friendly copy.

### 6.4 Table improvements

- Make the `Full Roster Rankings` table visible by default on the Rankings tab.  Replace the dark bar with a clearly labelled button or collapse/expand control.
- Implement column header sorting: clicking a header cycles through ascending, descending and unsorted.  Display a small arrow next to the active sort.  Provide tooltips or abbreviations for each column.
- Allow multi‑select filters: users should be able to filter by multiple positions at once (e.g., RB + WR) and clear filters easily.  Add filters for rookies, injured players, picks and player availability.
- On small screens (≤ 1024 px), use sticky player columns and horizontal scroll for numeric columns.  At ≤ 768 px, convert rows into cards with key metrics and an expandable details panel.  Provide a sort dropdown on mobile.
- Add pagination or infinite scroll if the table is too long; show 50–100 players per page.
- Add proper status badges (e.g., `Q` for questionable, `IR` for injured reserve) with tooltips.  Use icons and labels, not just colour.

### 6.5 Player modal enhancements

- Add a close `×` button in the modal header and allow closing via Esc key and clicking outside.
- Group metrics logically: create sections or tabs for Season Value, Dynasty Value, Trend/Change, Cross‑Position Comps and Schedule.  Use clear headings and larger fonts.
- Make the cross‑position comps clickable: clicking a comp name opens that player’s modal.  Provide tooltips explaining the purpose of the comps.
- Add TE premium and superflex badges within the modal if applicable.  Show whether values reflect dynasty or redraft context.  If the league is redraft, hide dynasty value section.
- Add a simple line chart showing dynasty value over time (optional if time permits; can be deferred to a later iteration).

### 6.6 UI/UX and visual consistency

- Create a design token system: define standard colours, typography scales, spacing increments, button styles, badges, shadows and card appearances.  Implement a reusable tab component with clear active states.
- Standardise buttons vs toggles: use distinct shapes and states for actions vs filters.  Use pill‑shaped chips for filters with active/inactive states.
- Increase contrast across the site to meet WCAG standards.  Replace purely colour‑based value change indicators with icon + colour combos.  Use darker or lighter backgrounds consistently.
- Adjust typography: ensure body text is at least 12–14 px; use consistent heading sizes; increase line height for readability.
- Provide consistent spacing: apply 8 px/16 px spacing scale across cards, tables and modals.
- Consolidate iconography: choose a single icon set and apply uniform stroke weight.  Add tooltips and alt text.

### 6.7 Responsiveness

- Define breakpoints for 1280 px, 1024 px, 768 px, 430 px and 390 px.  Use flexbox or CSS grid to reflow content at each breakpoint.
- Hide or collapse less important metrics on small screens.  Convert tables to cards or accordions.  Ensure bottom navigation is accessible via a hamburger menu or floating action button.
- Increase tap target sizes to at least 44×44 px on mobile.  Provide enough spacing for finger navigation.
- Test orientation changes on tablets; ensure charts resize appropriately.

### 6.8 Accessibility

- Implement visible focus outlines on all interactive elements.  Use CSS `:focus-visible` or similar.
- Ensure all interactive elements have accessible names via `aria-label` or `<label>`.  Use `<button>` elements rather than `<div>`s for clickable items.
- Add alt text to avatars and icons.  Provide descriptive labels for progress bars and badges (e.g., `Up 2% value`).
- Trap focus within modals and return focus to the triggering element on close.  Add Esc key to close modals.
- Ensure error messages are accessible and announced via `aria-live` regions.
- Verify colour contrast meets WCAG AA (4.5:1) and adjust colours accordingly.
- Add skip links to bypass repetitive navigation.

## 7. League‑specific acceptance criteria

After implementing the above, the following criteria must be satisfied for each test league:

### Skids Get Beat (Dynasty, Superflex, Half‑PPR)

- The league header displays `Dynasty`, `SF`, and `Half PPR`.  No `TE Premium` tag appears.
- Dynasty values and dynasty ranks are shown; redraft projections are secondary.
- Quarterbacks are valued highly; cross‑position comps emphasise QBs.
- Taxi squad and future pick analysis features are available.

### The Fantasy Degenerates (Dynasty, Superflex, TE premium)

- The league header displays `Dynasty`, `SF`, `TE Premium`, and the correct scoring tag (e.g., `PPR` if applicable).
- Tight end values and projections reflect TE premium multipliers; TEs appear higher relative to other positions compared to Skids Get Beat.
- The player modal indicates TE premium context.
- All dynasty features remain; superflex and dynasty tags present.

### test league (Redraft, non‑superflex, non‑TE‑premium, draft complete)

- The league header displays `Redraft` (or no dynasty tag) and no `SF` or `TE Premium` tags.
- Rankings and values focus on current‑season projections and weekly ranks; no dynasty values or long‑term context appear.
- Start/sit recommendations and weekly projections are visible; taxi squad and draft capital analysis sections are hidden.
- Draft analysis charts show data only for the recent draft; no future rookie picks.

### Gov Tech Grid Iron (Redraft, non‑superflex, non‑TE‑premium, draft incomplete)

- The league header displays `Redraft` and indicates draft status (e.g., `Pre‑draft`).
- A clear empty state explains that the draft has not yet occurred.  Features requiring rosters (e.g., team grades, trade receipts) are hidden or disabled.
- Users can still view global player rankings suitable for redraft context (current‑season projections) and plan for the draft.

## 8. Page‑by‑page instructions

For each page (Overview, Momentum, Rankings, Trades, Draft, Player modal), review the corresponding audit sections and implement the recommended changes.  Pay particular attention to the following:

- **Overview:** emphasise league context, ensure cards are aligned and responsive, and provide accessible headings.  Hide dynasty‑only features in redraft leagues.
- **Momentum:** ensure trend charts are labelled clearly and include tooltips; adjust colours for accessibility.  Hide or adjust for redraft where appropriate.
- **Rankings:** implement table improvements, filters, and responsive behaviour.  Provide context labels for values.  Adapt to league type and scoring settings.  Add multi‑select filters.
- **Trades:** ensure metrics reflect league context (dynasty vs redraft).  Hide irrelevant metrics in redraft (e.g., draft capital efficiency).  Provide accessible tables or charts.
- **Draft:** show draft capital efficiency and decision audit only when the draft is complete; otherwise show pre‑draft empty state.  For redraft leagues, reduce emphasis on rookie draft.
- **Player modal:** restructure content; add close button; adapt to league context; add interactive comps; ensure accessibility.

## 9. Table‑specific instructions

- Consolidate table component logic into a single reusable component with props for columns, sorting, filtering and responsive layout.
- Use accessible `<table>` semantics with `<thead>`, `<tbody>`, `<th>` and `<td>`.  Label rows and columns for screen readers using `scope` attributes.
- Provide `aria-sort` attributes on sortable columns and announce sort direction.
- On mobile, convert tables into cards or lists.  Provide `aria-expanded` attributes for collapsible items.

## 10. Player‑modal‑specific instructions

- Extract player modal into a component that accepts player data and league settings as props.
- Use a dialog with `role="dialog"` and `aria-modal="true"`.  Trap focus inside and return focus on close.
- Add headings (`<h2>` etc.) for each section.  Avoid using only bold text for structural hierarchy.
- Provide alt text for team logos and icons.  Use accessible labels for value change (e.g., “Increased by 1.9 percent”).

## 11. Mobile/responsive instructions

- Use CSS media queries or a responsive framework to adjust layouts.  Do not rely on overflow hidden for tables.
- Provide collapsible navigation on mobile; transform the bottom nav into a top or side drawer.
- Test on at least the breakpoints specified in the Responsive audit and adjust spacing, fonts and controls accordingly.

## 12. Accessibility instructions

- Implement keyboard navigation and focus management across all components.
- Ensure all interactive elements have accessible names.  Use labels instead of placeholders in forms.
- Provide text alternatives for non‑text content (icons, charts).  Use ARIA roles and attributes appropriately.
- Maintain colour contrast; avoid using colour alone to convey meaning.

## 13. Visual consistency instructions

- Define and use a design token system for colours, typography, spacing, borders and shadows.  Apply these consistently across components.
- Create reusable components for tabs, badges, buttons, modals, cards and tables.  Avoid ad‑hoc styling in individual components.
- Review the Visual System Consistency audit for specifics on fonts, colours, icons and spacing inconsistencies.

## 14. Empty/loading/error state instructions

- Replace indefinite loading overlays with progress indicators that include error handling and cancel/retry options.
- Create reusable empty state components with icons and clear copy.  Use them in search results, pre‑draft leagues and any component with no data.
- Capture and display API errors in a user‑friendly way.  Provide contact or support links if persistent.

## 15. Constraints

- **Do not** remove the playful brand entirely, but tone down copy where it interferes with clarity.
- **Do not** implement speculative features not requested by the audit.  Focus on the issues listed.
- **Do not** alter backend APIs unless necessary to fetch league settings and scoring rules.  Use read‑only endpoints provided by Sleeper.
- Preserve existing file structures and follow project conventions (e.g., use React components, styled‑components or Tailwind as originally used).
- Run tests, lints and type checks (if available).  Provide descriptive commit messages summarising changes.

## 16. Acceptance criteria

Implementation is considered complete when:

- Users can select and switch between all four test leagues without being stuck in a loading overlay.
- Each league displays accurate tags for dynasty/redraft, superflex, TE premium and draft status.
- Rankings, values, projections and player modals adjust to the league’s settings as described in the league‑specific acceptance criteria.
- Loading overlays, empty states and error states provide clear messaging, timeouts and retry options.
- Accessibility basics are met: focusable elements with visible focus, ARIA labels, alt text, appropriate colour contrast, keyboard navigable modals.
- Full Roster Rankings table is discoverable, sortable, filterable and responsive across breakpoints.  Player modals have close buttons, grouped content and interactive comps.
- Visual design is consistent: unified colours, typography and spacing.
- The app passes the `LAUNCH_QA_CHECKLIST.md` items.

## 17. Tests/checks commands

If the project includes scripts for testing or building (e.g., `npm test`, `npm run lint`, `npm run build`), run them to ensure no new errors are introduced.  Provide screenshots or logs of successful runs if possible.

## 18. Final response requirements

After implementing changes, respond with:

1. A summary of all changes made, grouped by page or component.
2. A list of files modified or added.
3. Confirmation that you followed the prioritisation and acceptance criteria.
4. Results of running tests/lints/build scripts (if applicable).
5. Screenshots or instructions for verifying major features (league switching, table responsiveness, etc.).

## 19. Likely files/components to change

- Components handling league selection and persistence (e.g., `LeagueProvider`, `useLeague`, `SwitchLeagueButton`).
- Pages: `Overview`, `Momentum`, `Rankings`, `Trades`, `Draft`.
- Components: `LoadingOverlay`, `FullRosterRankingsTable`, `PlayerModal`, `Filters`, `Tabs`, `Badges`.
- Stylesheets or theme files defining colours and spacing.
- Utilities for fetching league settings from Sleeper API.
- Context or hooks for scoring settings and UI toggles.

## 20. Issues to address vs not to address

- **Address:** All issues marked as launch blockers or high severity in the audit documents (UI‑001 to UI‑006, PM‑001 to PM‑004, R‑001 to R‑006, A11y‑001 to A11y‑006).  Fix at least medium severity items where reasonable.
- **Do not address yet:** Lower‑priority enhancements (UI‑010 to UI‑012, PM‑005 to PM‑007, minor visual tweaks) unless time permits.  These can be scheduled for a later iteration.

## 21. Stop conditions

- Stop coding once all launch blockers and high severity issues are resolved and the acceptance criteria are met.  Minor polish items can be deferred.  Do not attempt to redesign the entire app.

