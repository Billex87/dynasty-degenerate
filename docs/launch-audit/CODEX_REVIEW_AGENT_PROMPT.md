# Codex Review Agent Prompt – Dynasty Degens

## Overview

You are a QA and review agent tasked with verifying the changes made by Codex based on the launch readiness audit for Dynasty Degens.  A comprehensive audit identified many issues, particularly around league selection, league‑specific logic, UI/UX, accessibility and responsiveness.  Codex has implemented fixes according to `MASTER_CODEX_IMPLEMENTATION_PROMPT.md`.  Your job is to confirm that these fixes have been applied correctly and that no regressions have been introduced.

## Instructions

1. **Review Codex’s summary and changed files.**  Read Codex’s implementation summary and examine the diffs.  Pay particular attention to files mentioned in the prompt (e.g., league selection logic, ranking table, player modal, loading overlay, responsive styles).
2. **Reopen Dynasty Degens** at [https://dynastydegens.com/](https://dynastydegens.com/) (or the provided preview URL if one is available).  
3. **Use the Sleeper username `mynameisbillex`.**  Login as you did during the audit.  Ensure the landing page no longer auto‑loads a league and the league selection modal appears when needed.
4. **Test all four leagues.**  Sequentially load and switch between **Skids Get Beat**, **The Fantasy Degenerates**, **test league** and **Gov Tech Grid Iron**.  Confirm that each league loads successfully and that the progress overlay finishes or shows a clear error within 10 seconds.
5. **Verify league‑specific logic.**  For each league, check that:
   - The header displays the correct tags (Dynasty/Redraft, Superflex, TE Premium, scoring type, draft status).
   - Rankings, values and projections adapt appropriately (e.g., dynasty vs redraft, QB emphasis in superflex, TE premium adjustments, draft‑complete vs pre‑draft states).
   - Unavailable features are hidden or replaced by helpful empty state messages.
6. **Re‑test core fantasy workflows** using the `LAUNCH_QA_CHECKLIST.md`.  At minimum:
   - League selection and switching.
   - Viewing player rankings and values (sorting, filtering, search, multi‑select filters).
   - Opening and closing the player modal (close button, Esc key, interactive comps).
   - Navigating through Overview, Momentum, Rankings, Trades and Draft tabs.
   - Checking loading, empty and error states by simulating search with no results and visiting the pre‑draft league.
   - Performing accessibility checks: keyboard navigation, focus indicators, alt labels, contrast checks.
   - Testing responsive layouts at 1440×900, 1024×768, and 390×844 using the browser’s responsive mode (if available).
7. **Confirm adherence to constraints.**  Verify that Codex did not rewrite the entire app, alter backend APIs unnecessarily or implement speculative features not requested.  Ensure humour remains but is toned down where confusing.
8. **Identify regressions.**  Note any features that previously worked but no longer do (e.g., missing charts, broken navigation).  Check for any styling inconsistencies introduced by the fixes.
9. **Produce a pass/fail QA report** summarising each check in the checklist.  For each failure, cite the issue ID from the audit if it relates, describe the impact and severity, and provide evidence (screenshots or citations).
10. **Prepare a follow‑up prompt for Codex** if unresolved issues remain.  Use the `CODEX_FOLLOWUP_PROMPT_TEMPLATE.md` to structure your request.  List only unresolved items; do not expand scope.

## Pass/fail checklist (summary)

Use the following to track results:

- [ ] League switching works and no auto‑load occurs.
- [ ] All four leagues load successfully and the progress overlay finishes or fails gracefully within 10 seconds.
- [ ] Tags show correct league type, superflex, TE premium and draft status.
- [ ] Rankings and values adjust to league context.
- [ ] TE premium adjustments are visible in The Fantasy Degenerates.
- [ ] Redraft leagues do not show dynasty language or long‑term values.
- [ ] Pre‑draft league shows empty states and hides roster‑dependent features.
- [ ] Full Roster Rankings table is discoverable, sortable, filterable, paginated and responsive.
- [ ] Player modal has a close button, accessible labels and interactive comps; values adapt to league context.
- [ ] Loading, empty and error states have clear messaging, timeouts and retry options.
- [ ] Accessibility improvements are in place (focus indicators, labels, contrast, keyboard navigation, modals trapping focus).
- [ ] Visual consistency improvements are applied (tabs, buttons, badges, typography, colours, spacing).
- [ ] Responsive layouts work across desktop, tablet and mobile.
- [ ] No regressions or new major bugs introduced.

## Deliverables

At the end of your review, provide:

- A pass/fail report covering each checklist item with comments and citations.
- A list of any unresolved audit issues and the corresponding audit IDs.
- A follow‑up prompt for Codex using the provided template, listing only unresolved items.

Do not approve the implementation until all Must Fix and High severity items are resolved.  If critical issues remain, highlight them clearly.

