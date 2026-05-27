# Baseline Map

This document captures the Stage 0 and Stage 1A audit snapshot for the `refactor/site-cleanup` branch. It is a baseline for future refactor stages, not an implementation record.

## App Baseline

- Framework: Vite + React SPA, not Next.js.
- Client routing: `wouter` routes in `client/src/App.tsx`.
- Server: Express + tRPC under `server`, with core entrypoints in `server/_core`.
- Deployment: Vercel, with `api/**` JavaScript shims re-exporting `dist/vercelApp.js`.
- Styling: Tailwind v4 plus large global CSS files imported from `client/src/index.css`.
- Tests: Vitest unit tests and Playwright e2e/visual/accessibility tests.

## Deploy And Rollback Notes

- Build command: `pnpm build`.
- Install command: `pnpm install`.
- Vercel output directory: `dist/public`.
- Serverless API shims under `api/**` route to the bundled Express app at `dist/vercelApp.js`.
- `vercel.json` includes cron schedules and security headers. Do not change it during file-organization or CSS refactors.
- `/api/:path*` responses currently receive private/no-store headers and noindex headers.
- Use Vercel preview deploys for broad refactors before production.
- Rollback should use Vercel deployment rollback or a git revert of the specific stage commit.

## Route Inventory

Client routes:
- `/` -> `Home`
- `/components` -> lazy `ReportComponentShowcase`
- `/loader-kit-preview` -> lazy `LoaderKitPreview`
- `/404` -> `NotFound`
- fallback -> `NotFound`

API routes:
- `/api/trpc`
- `/api/cron/ktc-snapshot`
- `/api/cron/league-report-cache`
- `/api/cron/prospect-snapshot`
- `/api/cron/dynamic-data-refresh`
- `/api/cron/fantasypros-endpoint-snapshots`

No Next.js `app/`, `pages/`, middleware, loading, error, or not-found route files were found.

## Core User Flows

- Homepage and report app are concentrated in `client/src/pages/Home.tsx`.
- Main flows include Sleeper username/league lookup, league preview, report generation, cached report restore, report tabs, rankings, draft analysis, trades, waiver intelligence, admin diagnostics, AI calibration, provider telemetry, and source coverage dashboards.
- Admin auth is passphrase/session-cookie based through `auth.adminLogin`, `auth.me`, and `auth.logout`.
- Feedback submits to Formspree from `FeedbackButton`.
- No payment or subscription flow was found.

## Error, Loading, And Empty States

- App-level error handling is provided by `client/src/components/ErrorBoundary.tsx`.
- Route fallback and `/404` render `client/src/pages/NotFound.tsx`.
- Loading states include suspense fallbacks, `LoadingAnimation`, report-section loading fallbacks, `DashboardLayoutSkeleton`, and loading states inside admin panels.
- Empty states use `EmptyState` and feature-local empty render branches across report tables, rankings, admin diagnostics, and player detail sections.
- Form errors appear in feedback, admin login, and report-generation flows; these should be checked after component extraction.

## SEO And Metadata

Central metadata lives in `client/index.html`:
- title, description, keywords, canonical, robots, Open Graph, Twitter card metadata
- structured `WebApplication` JSON-LD
- favicon and manifest links
- Google Fonts preconnect/link tags

Important public files:
- `client/public/robots.txt`
- `client/public/sitemap.xml`
- `client/public/site.webmanifest`
- favicons and Open Graph assets under `client/public/`

Do not remove these during cleanup.

## Integrations And Environment

Referenced environment variables include:
- `DATABASE_URL`
- `JWT_SECRET`
- `ADMIN_LOGIN_PASSWORD`
- `ADMIN_PASSWORD`
- `ADMIN_PERMISSIONS`
- `CRON_SECRET`
- `LEAGUE_REPORT_WARM_LEAGUE_IDS`
- `FANTASYPROS_API_KEY`
- `FANTASY_NERDS_API_KEY`
- `DRAFTSHARKS_API_KEY`
- `SPORTSDATA_IO_API_KEY`
- `OPTICODDS_API_KEY`
- `VITE_FEEDBACK_FORM_ENDPOINT`
- `VITE_SHOW_ASSISTANT_FEATURE_RADAR`
- `VITE_SUPPORT_LABEL`
- `VITE_SUPPORT_URL`
- `VITE_VALUE_HISTORY_SHARDS_BASE_URL`

External integrations include Sleeper, FantasyPros, KeepTradeCut/local KTC snapshots, FantasyCalc, DynastyProcess, Flock, Fantasy Nerds, Dynasty Nerds-style sources, DraftSharks, SportsDataIO, OpticOdds, nflverse data, Formspree, Vercel Analytics, Vercel Speed Insights, Drizzle/MySQL, and optional S3-compatible storage for value-history shards.

## High-Risk Files

- `client/src/styles/report-responsive.css` - very large global responsive CSS surface.
- `client/src/styles/report-foundation.css` - very large global foundation/report CSS surface.
- `client/src/pages/Home.tsx` - main homepage/report/admin flow controller.
- `client/src/styles/report-surfaces.css` - large report surface styling.
- `client/src/components/ReportTables.tsx` - mixed report table/rendering logic.
- `server/routers.ts` - large tRPC router and orchestration layer.
- `client/src/components/PlayerDetailModal.tsx` - modal, data fetching, timeline, and details all coupled.
- `server/reportGenerator.ts` - core report generation logic.
- `client/src/components/CommandCenterExpansion.tsx`
- `client/src/components/reportTables/tradeLedgerUtils.tsx`
- `client/src/components/reportTables/TradeWarRoom.tsx`
- `client/src/lib/autopilot/buildAutopilotData.ts`
- `client/src/components/reportTables/WaiverIntelligencePanel.tsx`
- `client/src/styles/ai-autopilot.css`
- `server/db.ts`

## CSS Baseline

- Global CSS is imported from `client/src/index.css`.
- No CSS modules were found in the audit.
- The largest CSS files are `report-responsive.css`, `report-foundation.css`, and `report-surfaces.css`.
- Broad selectors target `.report-shell`, report tables, rankings, modals, loading states, admin panels, and homepage surfaces.
- Keyframes and loading/success animation names overlap across several files.
- Inline styles are used for dynamic positioning, colors, gauges, charts, and CSS variables.

## Accessibility And Responsive Risk Areas

- Keyboard risk areas: report tabs, collapsible report sections, Radix dialogs/dropdowns/selects, admin controls, rankings filters, trade/draft controls, and player detail modals.
- Semantic HTML risk areas: large custom table/card hybrids in report surfaces and rankings rows.
- Forms/labels risk areas: homepage league lookup, admin passphrase flow, feedback dialog, filters, and hidden honeypot-style fields.
- Modal/dropdown risk areas: `PlayerDetailModal`, `ManagerDraftPicksModal`, feedback dialog, Radix select/dropdown components, and admin drilldown panels.
- Mobile layout risk areas: homepage hero, report header/footer, report tabs, draft analysis rows, rankings rows, trade tables, player modal, and admin diagnostics.

## Vercel CPU Risk Baseline

Primary CPU risk areas:
- `league.analyze` mutation and report generation paths in `server/routers.ts`.
- `buildLeagueRankingsPayload` and rankings cache behavior.
- League report cache warmer cron.
- Dynamic data refresh cron.
- Public tRPC procedures that perform heavy provider/report work unless cache hits.
- Player detail modal queries that can fan out on open.
- Admin dashboards querying source health, provider telemetry, source coverage, abuse telemetry, and calibration data.

API responses are private/no-store by default. CPU fixes should focus on server-side cache hits, scheduled work, payload size, and client query gating rather than caching private HTTP responses.

## Possible Unused Candidates

Review-only candidates:
- `header-kit/`
- `home-image-kit/`
- `interactive-globe/`
- `rightpanel/`
- `loader-kit/`
- `client/src/_core/loader-kit/`
- `client/src/pages/ComponentShowcase.tsx`
- `.DS_Store` files, `dev_server.log`, `.tmp.prod.env`

Do not delete any of these without import/search evidence and verification.

## Manual QA Baseline

After visual, CSS, component, or routing refactors, manually check:
- `/` signed-out homepage on desktop/tablet/mobile
- report generation flow and loading/success modal
- report tabs: overview, command center, rankings, trades, draft, waiver/autopilot surfaces
- player detail modal
- draft analysis startup vs rookie behavior
- rankings board and DraftBuzz scoreboard
- admin diagnostics panels
- `/components`
- `/loader-kit-preview`
- `/404`

Preferred Playwright viewport coverage:
- mobile: `390x844`
- tablet: `834x1194`
- desktop: `1440x1000`

## Visual Baseline Checklist

- Homepage hero crop, brightness, logo, headline wrapping, CTA spacing, and feature cards.
- Report generation loading modal, success state, and transition back into report content.
- Report shell header, tabs, footer, admin/view-as controls, and mobile logo treatment.
- Overview command center, manager cards, rankings board, draft analysis, trade/waiver surfaces, and player detail modal.
- Loading, empty, error, and locked/admin states.
