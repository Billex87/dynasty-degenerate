# Launch QA Checklist – Dynasty Degens

Use this checklist to verify the product after Codex implements the launch‑readiness improvements.  Each item should be marked pass/fail.  Items are grouped by category.  Evidence or screenshots should be recorded for failures.  

## Global navigation

- [ ] The site loads without auto‑selecting a league or shows a clear way to change leagues.
- [ ] The **Switch League** button opens the league selection modal from any page.
- [ ] The league selection modal lists all of the user’s leagues with avatars and names and does not duplicate or mislabel entries.
- [ ] Selecting a league loads the correct league and closes the modal.
- [ ] The active league name and format tags are visible in the header.

## Sleeper username entry

- [ ] The landing page includes labelled input fields for Sleeper username and optional league ID, not just placeholders.
- [ ] Submitting a username successfully fetches leagues or displays a helpful error if the username is invalid.

## League selection & switching

- [ ] Users can switch between Skids Get Beat, The Fantasy Degenerates, test league and Gov Tech Grid Iron without reloading the page or getting stuck.
- [ ] League switching retains previous filters and scroll positions where appropriate.
- [ ] Loading overlay finishes within reasonable time (< 10 seconds) or shows an error/timeout with retry.

## League setting detection

For each league:

- [ ] The header displays correct labels for `Dynasty` vs `Redraft`.
- [ ] The header displays `Superflex` or no tag based on roster settings.
- [ ] The header displays `TE Premium` tag when applicable.
- [ ] The draft status is detected (e.g., `Pre‑draft`, `In Season`, `Completed`).

## Dynasty vs redraft behaviour

- [ ] Dynasty leagues show dynasty‑specific language (rebuild, contender, taxi squad, future picks) but not redraft‑only features.
- [ ] Redraft leagues show current‑season projections, start/sit recommendations and do not show dynasty value columns or long‑term context.
- [ ] No dynasty labels appear in test league or Gov Tech Grid Iron.

## Superflex behaviour

- [ ] In superflex leagues, quarterback value is visibly higher than in otherwise similar one‑QB leagues.
- [ ] Superflex leagues display an `SF` tag in the header and possibly inside player modals.

## Tight End premium behaviour

- [ ] In TE premium leagues, tight ends receive increased projected points and dynasty values compared to non‑premium leagues.
- [ ] The header displays a `TE Premium` tag.
- [ ] Player modals indicate TE premium context.

## Draft‑complete behaviour

- [ ] For leagues with completed drafts (Skids Get Beat, test league), team and roster analysis features are fully available.
- [ ] Draft analysis (capital efficiency, draft decision audit) displays meaningful data.

## Draft‑incomplete behaviour

- [ ] For Gov Tech Grid Iron (pre‑draft), features requiring rosters or draft history are hidden or disabled.
- [ ] Pre‑draft pages show clear messages explaining that the draft is not completed and what users can do in the meantime.

## Major pages/routes

For each league, verify the following pages render and function:

- [ ] Overview: cards display correct data and league context.
- [ ] Momentum: Heat Check, Cold Streak, Trend Stack and other widgets populate with current data or indicate when unavailable.
- [ ] Rankings: Full roster rankings table is discoverable, sortable, filterable and responsive.
- [ ] Trades: Trade analysis metrics calculate correctly; deals and receipts display or state none available.
- [ ] Draft: Draft analysis shows appropriate charts; pre‑draft leagues show empty states.
- [ ] Player modal: Contains season value, dynasty value (if applicable), value change, comps and schedule; includes a close button; adapts to league context (superflex, TE premium, redraft vs dynasty).

## Tables

- [ ] The Full Roster Rankings table displays the correct number of players and updates when filters/search are applied.
- [ ] Columns are clearly labelled with context (Dynasty Value vs Season Value etc.).
- [ ] Column sorting works for all numeric columns; sort state is indicated.
- [ ] Multi‑select filters (e.g., RB + WR) are supported.
- [ ] Table rows are clickable and open the player modal without losing scroll position.
- [ ] On mobile (≤ 430 px), tables convert to card layouts or use horizontal scroll with sticky player columns.
- [ ] Empty search states display a message (e.g., “No players found”).

## Filters, search & sorting

- [ ] Position filters toggle clearly and support multiple selections.
- [ ] The search field is labelled and supports searching by name and team.
- [ ] Sorting by value, weekly rank and age works and indicates active sort.

## Pagination and load more

- [ ] For lists longer than ~50 items, pagination or load‑more functionality is implemented.

## Dropdowns & selects

- [ ] All dropdowns and select components include labels and provide clear selected state.

## Cards & modals

- [ ] Cards have consistent header styles, padding and shadows.
- [ ] Player modals include a close button and respond to Esc key.
- [ ] Modal focus is trapped while open and returned to the trigger on close.

## Forms & inputs

- [ ] All inputs have associated `<label>` elements.
- [ ] Placeholder text is not used as a substitute for labels.
- [ ] Required inputs are indicated as such.

## Loading states

- [ ] All pages display skeletons or spinners while data loads.
- [ ] If loading exceeds 10 s, show a message and retry option.

## Empty states

- [ ] Empty or pre‑draft league pages include explanatory messages, not blank screens.
- [ ] Search returning no results shows a friendly message.

## Error states

- [ ] Failed API calls surface a user‑friendly error message with retry option.
- [ ] The app does not display raw JSON or HTTP errors.

## Accessibility basics

- [ ] All interactive elements are focusable via keyboard and have visible focus indicators.
- [ ] All buttons and icons have accessible labels (`aria-label` or `<label>`).
- [ ] Colour contrast meets WCAG AA standards.
- [ ] Modals trap focus and can be closed with Esc key.
- [ ] Loading overlays have appropriate `aria-live` attributes.

## Performance & perceived speed

- [ ] API responses and page transitions occur within 1–2 seconds under normal network conditions.
- [ ] Heavy computations (e.g., draft analysis) are deferred until needed.

## Visual polish

- [ ] Consistent typographic scale and colour palette across pages.
- [ ] Buttons and toggles have clear hover, active and disabled states.
- [ ] Icons are unified in style and accompanied by tooltips.

## Regression checks

- [ ] Fixes for league switching do not break existing functionality (e.g., analytics or data loading).
- [ ] New responsive layouts do not introduce visual glitches on desktop.
- [ ] Accessibility improvements do not degrade UI aesthetics.

## Final launch readiness

- [ ] All “Must Fix” issues from the risk register have been addressed.
- [ ] All High severity items from the UI/UX and accessibility audits are resolved.
- [ ] The product functions correctly across all four test leagues and major devices.
- [ ] Stakeholders (fantasy players, testers, product owners) have signed off on the improvements.

