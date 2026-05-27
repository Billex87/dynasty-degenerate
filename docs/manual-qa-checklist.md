# Manual QA Checklist

Use this checklist after CSS, component, routing, CPU, or large-file refactor stages.

## Routes To Inspect

- `/`
- `/components`
- `/loader-kit-preview`
- `/404`
- fallback unknown route such as `/missing-route-smoke`

## Mobile And Desktop Checks

- Mobile viewport: `390x844`
- Tablet viewport: `834x1194`
- Desktop viewport: `1440x1000`
- Homepage hero crop, logo, title wrapping, CTA spacing, and feature cards.
- Report shell header, tabs, footer, manager/view-as controls, and sticky or overflow behavior.
- Tables and card grids should not overflow or stretch leftover rows awkwardly.
- Modals should fit within viewport height and retain usable close controls.

## Forms

- Sleeper username lookup.
- League ID lookup if the legacy input is visible.
- League picker/history selection.
- Admin passphrase form.
- Feedback dialog form, including required message and success/error states.
- Search and filter controls in rankings, draft, trade, waiver, and admin panels.

## Auth-Sensitive Flows

- Admin login, logout, and `auth.me` state.
- Admin-only diagnostics panels.
- Protected mutations for AI predictions, action plans, and outcome feedback.
- Session cookie behavior after refresh.

## Payment Or Subscription Flows

- No payment or subscription flow was found in the Stage 0/1A audit.
- If one is added later, include checkout, webhook, subscription status, cancellation, and billing portal checks here.

## CSS Or Component Refactor Surfaces

- Homepage signed-out view.
- Report generation loading and success modal.
- Report overview/command center.
- Rankings board and DraftBuzz scoreboard.
- Draft analysis, including startup and rookie draft displays.
- Trades tab, trade war room, trade history, and trade proposal signals.
- Waiver intelligence and trending/player tiles.
- Player detail modal.
- Manager draft picks modal.
- Admin diagnostics panels.

## API Routes Touched By CPU Fixes

- `/api/trpc`
- `/api/cron/ktc-snapshot`
- `/api/cron/league-report-cache`
- `/api/cron/prospect-snapshot`
- `/api/cron/dynamic-data-refresh`
- `/api/cron/fantasypros-endpoint-snapshots`

For CPU-related changes, verify cache-hit behavior, auth boundaries, cron authorization, and failure responses without printing secret values.

## SEO And Metadata

- `client/index.html`
- `client/public/robots.txt`
- `client/public/sitemap.xml`
- `client/public/site.webmanifest`
- favicons under `client/public/`
- Open Graph card assets under `client/public/assets/`
- Vercel analytics and speed insights should remain production-only and not local-hosted.
