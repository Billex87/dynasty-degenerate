# Empty, Loading, Error and Draft‑Incomplete State Audit – Dynasty Degens

This audit evaluates the states a user encounters when data is unavailable or loading.  Because only the Skids Get Beat league loaded successfully, many other states (pre‑draft, no data, error) remain untested.  The loading overlay is the primary state observed.

## Loading state

- **Overlay appearance:** After selecting a league or running analysis, the app displays a full‑screen overlay with humorous tasks (e.g., “Hacking into Sleeper servers…”, “Cooking the market value books”).  A progress bar shows the current step.  
- **Duration:** In the first load, the overlay progressed through steps and eventually reached the final page.  On subsequent attempts to load other leagues, the overlay repeatedly hung at “Finalizing”【949679682831659†screenshot】 and never completed.
- **No cancel or retry:** There is no visible cancel or refresh option.  The Esc key does not always dismiss the overlay.  Users are forced to close the tab and reopen the site.
- **Messaging tone:** The comedic copy fits the brand but may confuse users who expect technical progress messages.  When the overlay hangs, there is no error explanation.

**Recommendations:**

1. **Add timeout and error messaging.** If the API call fails or times out, display a clear error message (“We’re having trouble loading your league. Please check your connection or try again.”) and provide a retry button.
2. **Include a cancel button.** Allow users to cancel loading and return to the league selection modal.
3. **Balance humour with clarity.** Keep the playful tone but include straightforward progress markers (e.g., “Fetching league data”, “Calculating rankings”).
4. **Ensure overlay always finishes.** The progress overlay must reliably proceed to the league dashboard once data is loaded.  Test across leagues and network conditions.
5. **Announce progress for screen readers.** Use `aria-live` regions to inform assistive technologies of progress and completion.

## Empty state (data unavailable)

- **Search results:** When typing in the search field of the rankings table, results update instantly.  If no players match, the table simply becomes empty with no message.  Users might think the table is still loading.  
- **No visible empty states elsewhere:** Because the Skids Get Beat league has complete data, there were no pre‑draft or rosterless states to examine.

**Recommendations:**

1. **Search empty state message.** When no players match the search or filter, display a friendly message such as “No players found. Try adjusting your search or filters.”
2. **Pre‑draft state messaging.** For leagues like Gov Tech Grid Iron, show a clear message like “Your draft hasn’t happened yet. Once teams are drafted, you’ll see roster analysis here.” Provide call‑to‑action suggestions (e.g., mock draft rankings, pick value charts).
3. **Hide unavailable features.** If a feature depends on completed drafts (e.g., draft efficiency charts), hide or disable it with a tooltip explaining why.
4. **Error boundaries.** Catch and display API errors (e.g., data fetch fails) within each component rather than letting the entire page fail silently.

## Error state

- **No error messages observed.** The only hint of error is the progress overlay stalling.  When `api.sleeper.app` calls failed in the browser, a raw JSON error appeared, but the user‑facing app does not display API errors.

**Recommendations:**

1. **Graceful API error handling.** Show a user‑friendly error message and offer retry options when API calls fail.
2. **Logging for developers.** Include error logging (e.g., Sentry) for diagnosing issues in production.

## Draft‑incomplete state (untested)

- **Expected behaviour:** For Gov Tech Grid Iron (draft incomplete), the app should hide roster/lineup analysis and show an empty state indicating the draft hasn’t occurred.  It should still allow viewing global rankings and pre‑draft projections.

**Recommendations:**

1. **Implement pre‑draft pages.** Provide pre‑draft ranking boards and strategy tips.  Hide or grey out features that require rosters (e.g., trade receipts).  Use clear copy to manage expectations.
2. **Allow switching to other leagues.** Ensure users can exit a pre‑draft league to view others.

### Summary

Dynasty Degens currently fails gracefully in only a few cases.  The loading overlay often hangs without explanation and offers no exit route.  Pre‑draft and no‑data scenarios were not experienced but should be addressed proactively.  Clear messaging, retry options, and accessible error states are required for a robust user experience.

