# Visual System Consistency Audit – Dynasty Degens

This audit evaluates whether the UI components adhere to a consistent visual system across the app.  Only the Skids Get Beat league was available for inspection.

## Consistency observations

| Component/style | Current inconsistency | Recommended standard | Where it appears | Priority | Codex implementation note |
|---|---|---|---|---|---|
| **Tabs** | Active tab is indicated by slightly brighter text; inactive tabs are a similar shade.  There is no underline or border. | Use a consistent active state indicator across all tabs (e.g., coloured underline, bolder text).  Inactive tabs should have lower opacity for contrast. | Top navigation across Overview, Momentum, Rankings, Trades, Draft. | Medium | Consolidate tab component into a reusable design system with tokenised colours. |
| **Buttons vs toggles** | Position filters (Overall, QB, RB etc.) look like buttons but behave as toggles.  Sort options (Value/Weekly/Age) look like toggle chips but are functionally mutually exclusive. | Define clear design patterns: buttons for actions, toggles for on/off, chips for filters.  Use consistent shapes (rounded vs pill) and selected/unselected states. | Rankings table filter bar. | Medium | Create a design token for chip backgrounds, borders and text colours. |
| **Card headers** | Some cards use uppercase headings with heavy fonts; others use mixed case. | Standardise heading style: choose either uppercase or sentence case and apply consistently across cards. | Overview cards (Top Heavy, Thin Ice), Draft cards. | Low | Adjust CSS classes for card headings. |
| **Fonts** | Font sizes vary significantly between sections.  Some body text is very small (9–10 px), while other labels are large. | Establish a typographic scale (e.g., 12 px body, 14 px secondary, 18 px headings) and apply consistently.  Ensure line heights are proportionate. | Throughout site, particularly tables and footnotes. | Medium | Define CSS variables for font sizes and spacing tokens. |
| **Colour palette** | Dark backgrounds vary from pure black to dark blue.  Buttons sometimes use teal, green or purple. | Consolidate dark backgrounds to a single shade (e.g., #0A0A12) and reserve accent colours for specific semantic meanings (green for positive, red for negative). | Backgrounds of modal, rankings bar, nav bar. | Medium | Create a palette file with named colours and use variables. |
| **Borders and shadows** | Some cards have subtle shadows; others are flat.  Table rows sometimes have separators; sometimes not. | Decide on a consistent card style: either flat minimal or light elevation.  Use 1 px separators between table rows. | Cards across Overview and Momentum pages; ranking table. | Low | Standardise CSS for card components and table rows. |
| **Iconography** | Icon sets appear mixed; some icons are line‑based, others are filled.  Many icons lack tooltips. | Use one icon library (e.g., Heroicons or Feather) and maintain consistent stroke width.  Provide alt text or tooltips. | Bottom nav icons, table badges, status icons. | Low | Replace mismatched icons with a unified set. |
| **Badges and tags** | Tags for `Dynasty`, `SF`, `Half PPR` appear as pill shapes with high contrast, while other tags (e.g., injury) use small squares. | Define a consistent badge component with variations (primary, secondary, status, format). | League header, player status badges. | Medium | Create a badge component with size options and colour tokens. |
| **Spacing** | Some cards and sections have tight vertical spacing; others have generous padding. | Apply a spacing scale (e.g., 8 px, 16 px, 24 px) consistently across cards, tables and modals. | Overview sections vs Momentum sections. | Low | Introduce a global spacing variable system. |
| **Modals** | Player modal uses a dark overlay with high elevation.  There is no consistent margin around edges; content touches edges on smaller screens. | Standardise modal container size and margins.  Add padding around content. | Player modal. | Low | Use a modal component with defined widths, padding and max‑height. |

## Summary

The visual design of Dynasty Degens is conceptually strong but lacks the cohesion of a polished design system.  Establishing consistent patterns for tabs, buttons, cards, typography, colours and spacing will enhance usability and make the product feel mature.  Implementing a design token system and central component library will help maintain consistency across future features and ensure that new elements align with the existing aesthetic.

