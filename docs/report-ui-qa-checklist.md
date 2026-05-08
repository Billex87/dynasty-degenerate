# Report UI QA Checklist

Use this before pushing larger report UI changes.

## Core Flow

- Run a known league report from the home screen.
- Confirm the report header, league switcher, and tab labels are visible and do not duplicate spoken labels.
- Confirm each tab opens with keyboard and pointer interaction.

## Rankings And Draft

- Open Full Roster Rankings, College Rankings, and Prospect Score Archive.
- Confirm Prospect Score Archive sorts by score first, not position.
- Confirm Player, Team, and School columns render distinct identity/icon cells.
- Confirm missing school/headshot values fall back cleanly without broken images.
- Open a player modal from Rankings and verify Cross-Position Trade Comps remain clickable.

## Momentum And Transactions

- Open Weekly Momentum.
- Confirm player cards show old value to new value without repeating the same current value.
- Confirm Recent Transactions shows Better Cut guidance only once, embedded under the affected row.
- Confirm K/DEF columns or pills do not appear when league settings/data do not use them.

## Responsive

- Check desktop around 1440px wide.
- Check tablet around 768px wide.
- Check mobile around 390px wide.
- Confirm there is no horizontal overflow and important identity rows appear before metrics.

## Accessibility

- Tab through top-level tabs, collapsible section triggers, player rows, and modal controls.
- Confirm focus states are visible.
- Confirm icon-only buttons have accessible names.
- Confirm duplicate responsive labels are `aria-hidden` when an explicit accessible label exists.

## Commands

```bash
pnpm check
pnpm build
git diff --check
```
