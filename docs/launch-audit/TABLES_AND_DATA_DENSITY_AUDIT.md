# Tables and Data Density Audit – Dynasty Degens

Fantasy football apps live or die by the usability of their tables.  This audit focuses on the **Full Roster Rankings** table within the Skids Get Beat league.  Other tables (draft analysis charts, owner counts) were seen but not analysed in depth due to time.

## Full Roster Rankings table

| Attribute | Observation |
|---|---|
| **Purpose** | Displays all players in the league universe with dynasty value, season value, age, and position information.  Serves as the primary resource for roster decisions and trade evaluations. |
| **Location** | `/?leagueId=<id>#rankings` – toggled by clicking the dark bar labelled `market board`【456310045724875†screenshot】. |
| **Columns** | 1) Rank number; 2) Player name with team abbreviation and small status badge (injury flag or BYE); 3) Positional rank; 4) Value (shows dynasty value or season value depending on selected metric); 5) Last year weekly finish (#POS); 6) Age; 7) Dynasty rank; 8) Value change (colour‑coded up/down). |
| **Column order** | Mostly logical: name first, then value metrics, then age and changes.  However, “Dynasty Rank” appears after age; it could be grouped with “Dynasty Value”. |
| **Sortable columns** | The table uses a top‑level toggle with three options: `Value`, `Weekly` and `Age`.  This acts as a global sort rather than per‑column sorting.  Individual column headers are not clickable. |
| **Default sort** | Appears to default to the `Value` view, ordering players by dynasty value descending. |
| **Search/filter behaviour** | Search field filters players by name or team.  Position filters (Overall/QB/RB/WR/TE/K/DEF/PICK) narrow the list; multiple positions cannot be selected simultaneously. |
| **Pagination** | The table is long; there is no pagination but there is a scroll bar.  When the player modal is opened and closed, the scroll position is preserved. |
| **Sticky headers/columns** | Column headers remain visible at the top of the table.  The player column is not sticky; if horizontally scrolling were needed on smaller screens, user could lose the names. |
| **Row density** | Rows are compact; players are separated by thin lines and subtle shading.  Good for large monitors but may be too dense on small screens. |
| **Header readability** | Column headings use small caps and subtle contrast.  Without a clear sort indicator, it may be unclear which metric is active. |
| **Cell readability** | Numeric values align left for player names and right for ranks/values.  Some long names (e.g., “Jaxon Smith‑Njigba”) truncate with ellipses but remain mostly legible. |
| **Badge/status rendering** | Injury or bye week statuses appear as small red badges next to the team abbreviation.  The colour red may not be accessible to colour‑blind users.  There is no tooltip explaining the status. |
| **Horizontal overflow** | On 1440px wide, no horizontal scroll is needed.  On smaller viewports, the table may overflow; responsive behaviour untested. |
| **Mobile behaviour** | Not tested.  Likely problematic due to number of columns. |
| **Empty state** | Not encountered, as the league contained players.  Unknown how an empty search or pre‑draft state is presented. |
| **Loading state** | The table appears after clicking `market board` bar; while loading, there is no spinner or skeleton.  Data pops in after some time. |
| **Row click behaviour** | Clicking any row opens the player detail modal.  Hover states highlight the row with a faint shading. |
| **Keyboard/focus behaviour** | Not tested.  No obvious focus outlines visible. |

## Usability issues & recommendations

| Problem | Recommendation | Desktop recommendation | Mobile recommendation | Priority | Effort |
|---|---|---|---|---|---|
| **Hidden entry** – The rankings table is hidden behind a small `market board` bar, which many users may overlook. | Make the full rankings table visible by default or replace the bar with a large, clearly labelled button. | Expand the table by default on desktop; provide a collapse control if needed. | On mobile, show a summary card with a button “View full rankings” to open the table in a new screen or modal. | Medium | Medium |
| **Global sort toggle confusion** – The `Value / Weekly / Age` toggle controls sorting but looks like filters.  There is no per‑column sorting. | Provide column header sorting with up/down arrows.  Use a separate control for view (dynasty vs season value). | On desktop, allow clicking each header to sort ascending/descending.  Show active sort indicator. | On mobile, include a sort dropdown above the table (e.g., Sort by: Value, Age). | Medium | Medium |
| **Column overload on small screens** – Eight columns may not fit on phone widths. | Use responsive design: collapse secondary metrics into expandable rows or cards.  Keep player name, position, team and primary value visible. | Use sticky player column and horizontal scroll for stats.  Consider grouping dynasty‑only stats under a toggle. | On mobile, convert each row to a card showing top metrics; tap to expand details. | High | Medium |
| **Poor status badge accessibility** – Injuries and bye weeks indicated by red badge alone. | Add a tooltip or label (e.g., `Q` for questionable, `IR` for injured reserve) and use shapes/icons plus colour to convey status. | Provide hover tooltip on desktop. | Use small icon and text on mobile. | Medium | Low |
| **No pagination or jump controls** – Scrolling through 200+ players is slow. | Add pagination (e.g., 50 rows per page) or quick search suggestions (top 50, rookies).  Provide “back to top” button. | Include page numbers at bottom. | On mobile, use infinite scroll with “load more” button. | Low | Medium |
| **Lack of filtering combinations** – Users can only select one position filter at a time. | Allow multi‑select filters (e.g., RB + WR) and add filters for rookie status, injury status, and roster status. | Add filter chips and a clear filter button. | Use dropdown filter drawers on mobile. | Medium | Medium |

The table is a powerful tool but requires improvements in discoverability, sorting clarity, accessibility and responsiveness.  Implementing these changes will make roster analysis faster and more intuitive, especially for mobile users.

