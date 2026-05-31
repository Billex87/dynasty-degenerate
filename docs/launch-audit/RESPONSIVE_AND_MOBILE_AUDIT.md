# Responsive and Mobile Audit – Dynasty Degens

**Note:** Only the desktop (1440×900) layout of the Skids Get Beat league was available for testing.  The app appears to be built primarily for desktop.  Because mobile usage is common among fantasy players, this section outlines expected issues and strategic recommendations for various viewports.

## Viewport considerations

| Viewport | Likely issues | Suggested adaptations |
|---|---|---|
| **1440×900 desktop** | Layout is dense but generally well‑organised.  Large tables fit within the viewport.  Bottom navigation is visible. | Continue to optimise for large screens with high data density.  Provide clear active states and section headings. |
| **1280×800 laptop** | Slight horizontal squeeze may cause table headers or filter buttons to wrap.  Bottom navigation may overlap content. | Use responsive typography and spacing to prevent wrapping.  Allow the bottom nav to collapse into icons or hide on scroll. |
| **1024×768 tablet landscape** | The full roster rankings table will likely require horizontal scrolling or will shrink columns.  Filters may wrap into multiple lines. | Implement sticky player columns and horizontal scroll for stats.  Provide a toggle to collapse secondary metrics. |
| **768×1024 tablet portrait** | The number of columns visible will be limited.  Overlays like the player modal may fill most of the screen. | Consider switching from table layout to card‑based layout for players.  Use tabs/segmented controls to switch between value, stats, and schedule.  Move filters into a collapsible drawer. |
| **430×932 large phone** | The current table design is unusable.  Navigation may require horizontal scrolling; filter buttons will wrap multiple times. | Replace the roster table with stacked cards for each player.  Show top metrics (value, rank, team) up front and allow tapping to view details in a full‑screen modal.  The bottom nav should become a floating action button or hamburger menu. |
| **390×844 standard phone** | Same as above, with even less horizontal space.  Touch targets may be too small. | Increase tap target sizes.  Use vertical lists and collapsible sections.  Provide quick actions (e.g., search) at the top. |
| **360×740 small phone** | Severe space constraints.  Many controls will not be visible. | Use a fully mobile‑first design: summarise league info in cards; hide or summarise less critical metrics; rely on modals for detail.  Ensure all inputs and buttons are at least 44×44 px. |

## Mobile strategy recommendations

1. **Condense tables into cards:**  On small screens, convert each player row into a card that shows name, team, position, primary value (dynasty or season depending on league) and rank.  Additional stats (age, value change, comps) can be displayed on an expandable panel or separate tabs within the modal.

2. **Sticky player columns and horizontal scrolling (desktop/tablet):**  For mid‑sized screens, keep the player name column fixed and allow horizontal scrolling for numeric stats.  Provide a horizontal scrollbar and ensure sorting remains visible.

3. **Segmented controls for sorting:**  Replace the small sort toggle with a segmented control or dropdown labelled “Sort by” that works well on mobile.  Position filters can be condensed into a dropdown or a horizontally scrollable chip list.

4. **Responsive bottom navigation:**  On mobile, the bottom nav should become a floating action button or slide‑out menu to save space.  Important actions like “Switch League” and “Run analysis” should remain easily accessible.

5. **Accessible touch targets:**  Increase button sizes and spacing for touch.  Use icons with labels for clarity.  Provide visual feedback on tap.

6. **Modals adapt to full screen:**  Player modals should open as full‑screen pages on mobile with a clear back/close button at the top.  Content should be reorganised into tabs (e.g., Overview, Projections, Trade Comps, Schedule) to avoid vertical scrolling.

7. **Simplify copy and data:**  On mobile, avoid verbose descriptions and complex charts.  Use concise bullet points and high‑contrast numbers.  Provide “learn more” links to deeper analysis for desktop use.

Without implementing these changes, the dense data tables and dark UI may be nearly impossible to use on small devices.  Fantasy players often set lineups on their phones; therefore, mobile readiness is essential for launch.

