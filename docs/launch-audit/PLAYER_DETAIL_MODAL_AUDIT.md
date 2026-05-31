# Player Detail Modal Audit – Dynasty Degens

This audit focuses on the player detail modal opened from the Full Roster Rankings table in the Skids Get Beat league.  Two sample players were reviewed: Josh Allen (elite QB) and Drake Maye (rookie QB).  The modal appears as a dark overlay and displays comprehensive player information.  

## Modal structure and content

| Section | Observations |
|---|---|
| **Header** | Shows player name, team and position at the top centre.  The team logo appears next to the name.  There is no explicit close button; the modal can only be closed by clicking outside. |
| **Season value & rank** | Displays current season value (e.g., `$63.1M`) and season rank (e.g., `#1 QB`), along with a small `S` icon.  Useful for redraft context. |
| **Dynasty value & rank** | Shows dynasty value (e.g., `$100.1M`) and dynasty rank (e.g., `#1 QB`).  This emphasises long‑term value, appropriate for dynasty. |
| **Value change** | Shows a percentage and arrow indicating value change over time (e.g., `+1.9%`).  The arrow is colour‑coded (green up, red down). |
| **Nearest cross‑position comps** | Presents a mini‑table listing the nearest QB, RB, WR and TE by dynasty value.  Each row includes the comparable player's name and team【776633316234301†screenshot】.  This helps gauge trade equivalencies across positions. |
| **Schedule / bye window** | Shows upcoming opponent teams and bye week.  It lists three upcoming weeks with opponent codes and colours.  Helpful for weekly start/sit decisions. |
| **Additional data** | The modal includes footnotes like last season's finish, age and tiers.  For rookies like Drake Maye, there are notes about draft capital and rookie projection. |
| **Navigation within modal** | There are no tabs or additional pages.  All data appears in a single column.  Scrolling is possible if the content exceeds viewport height. |

## Usability findings

| ID | Severity | Problem | Why it matters | Suggested fix | Acceptance criteria |
|---|---|---|---|---|---|
| **PM‑001** | High | **No close button** – Users can only close the modal by clicking outside its boundaries.  There is no `×` icon or Esc key support. | Users may not realise how to close the modal, especially on mobile.  This decreases discoverability and accessibility. | Add a close icon (“×”) in the top right of the modal.  Implement Esc key to close. | A visible close button exists and clicking outside or pressing Esc closes the modal. |
| **PM‑002** | Medium | **Dense top metrics** – Season value, dynasty value and rank are stacked in a tight area with small font size. | Information overload may overwhelm users. | Group metrics with clearer labels (e.g., columns with headings “Season (redraft)” and “Dynasty”) and use larger fonts. | Metrics are grouped logically and legible without zooming. |
| **PM‑003** | Medium | **Colour‑only value change indicator** – The arrow colour indicates increase/decrease but lacks textual context for screen readers or colour‑blind users. | Fails accessibility guidelines and makes it hard to interpret. | Add text labels (e.g., “+1.9% rise”) or arrow icons with labels. | Users can understand value change without relying on colour. |
| **PM‑004** | Medium | **Schedule table cramped** – Upcoming opponent codes appear in a single line without context (e.g., `BUF vs KC`). | Hard to interpret; novices may not know team codes. | Use full team names or tooltips on hover.  Provide week numbers. | Schedule clearly lists week numbers and team names. |
| **PM‑005** | Low | **No TE premium/format indicators** – If the league were TE premium or non‑superflex, the modal would need to adapt accordingly (e.g., highlight TE premium value, show superflex icon). | Without adaptation, players may misinterpret values. | Include tags showing if values reflect TE premium, superflex or redraft context. | Modal header includes small badges for SF, TE premium or redraft. |
| **PM‑006** | Low | **Cross‑position comps not interactive** – The comps list is static; clicking names does nothing. | Users may wish to jump to the comp player's modal for comparison. | Make comp names clickable; open their modals. | Clicking a comp row opens that player's modal. |
| **PM‑007** | Low | **Lack of historical data** – There is no trend chart showing value over time. | Users cannot see long‑term trajectory of the player's value. | Add a simple line chart of dynasty value or weekly points over time. | Chart appears showing value history with hover tooltips. |

## Overall assessment

The player detail modal packs a lot of useful information into a single view.  The cross‑position comps are particularly powerful for trade evaluation.  However, the modal suffers from discoverability (no close button), density (small fonts), and some accessibility issues (colour‑only indicators, unclear abbreviations).  Adding a close button, grouping metrics clearly, and enriching the comps table would significantly enhance usability.

