# Vercel Usage Review - 2026-06-01

## Scope
- Production usage review after the launch audit implementation, R-008 API-warning follow-up, and June operations readiness pass.
- Target app: `https://dynastydegens.com/`
- Deployment reviewed: production deployment for commit `bf011cd` (`Record June operations readiness pass`), status `Ready`.
- Follow-up refresh reviewed latest production commit `5fb087f` (`Fix report section heading hierarchy`), status `Ready`.

## Commands And Checks Run
- `npx --yes vercel@latest whoami`
- `npx --yes vercel@latest project ls`
- `npx --yes vercel@latest ls dynasty-degenerate --prod`
- `npx --yes vercel@latest inspect dynastydegens.com --logs`
- `npx --yes vercel@latest crons list`
- `npx --yes vercel@latest metrics schema vercel.function --format json`
- `npx --yes vercel@latest metrics vercel.function_invocation.function_cpu_time_ms -a sum --group-by route --since 24h --format json`
- `npx --yes vercel@latest metrics vercel.function_invocation.count -a sum --group-by route --since 24h --format json`
- `npx --yes vercel@latest metrics vercel.function_invocation.fot_total_bytes -a sum --group-by route --since 24h --format json`
- `npx --yes vercel@latest usage --format json`
- `npx --yes vercel@latest logs --environment production --since 1h --level error --json --limit 100`
- `npx --yes vercel@latest logs --environment production --since 1h --status-code 500 --json --limit 100`
- `npx --yes vercel@latest logs --environment production --since 1h --query cron --json --limit 50`
- `npx --yes vercel@latest logs --environment production --since 2h --level error --json --limit 100`
- `npx --yes vercel@latest logs --environment production --since 2h --status-code 500 --json --limit 100`
- `npx --yes vercel@latest logs --environment production --since 24h --query cron --json --limit 100`
- `npx --yes vercel@latest metrics vercel.function_invocation.peak_memory_mb -a max --group-by route --since 24h --format json`
- Production Playwright traffic session across the four representative leagues.
- Responsive production Playwright smoke across mobile and tablet projects.

## Production Traffic Session
- Generated: `2026-06-01T20:45:02.318Z`
- Username: `mynameisbillex`
- Evidence file: `output/playwright/vercel-usage-traffic-session-2026-06-01.json`

Representative leagues loaded successfully:
- `Skids Get Beat` -> `https://dynastydegens.com/?leagueId=1312139584427012096`
- `The Fantasy Degenerates` -> `https://dynastydegens.com/?leagueId=1312515568795934720`
- `test league` -> `https://dynastydegens.com/?leagueId=1358208869058224128`
- `Gov Tech Grid Iron` -> `https://dynastydegens.com/?leagueId=1313698287378788352`

Traffic-session result:
- Console errors: `0`
- Failed non-player-image requests: `0`
- 5xx responses: `0`

## Deployment State
- CLI auth: `billex87`
- Project scope: `billex87s-projects`
- Project: `dynasty-degenerate`
- Latest production URL from `vercel ls`: `https://dynasty-degenerate-ae111t4f4-billex87s-projects.vercel.app`
- Production deployment status: `Ready`
- Build completed from commit `bf011cd`.
- Build warnings remain the known Vite/Three.js dynamic import chunk warning and large bundle warnings.
- Follow-up refresh: latest production URL from `vercel ls` was `https://dynasty-degenerate-c29tx2e53-billex87s-projects.vercel.app`; Vercel connector confirmed deployment `dpl_5PqHENRxord7mYP4sje6NH8ZJw7w` is `READY` for commit `5fb087f`.
- Final deployment refresh after Home refactor and AI-read docs follow-up: `https://dynasty-degenerate-fggoi6z1c-billex87s-projects.vercel.app` inspected as deployment `dpl_AFqMDXkufYkeg2yXuUyUQVx4hMdP`, status `Ready`, aliased to `https://dynastydegens.com`, `https://dynasty-degenerate.vercel.app`, and the main project aliases.
- Post-cron-window refresh: `https://dynasty-degenerate-doo7utupo-billex87s-projects.vercel.app` inspected as deployment `dpl_JAzH9xMCBNR6c9VdN1cn8TsiTFdL`, status `Ready`, aliased to `https://dynastydegens.com`, `https://dynasty-degenerate.vercel.app`, and the main project aliases. The deployment was a redeploy of commit `35f3377`, which matched local `HEAD` and `origin/main`.
- Latest Home-cleanup refresh: `https://dynasty-degenerate-38o63iwy5-billex87s-projects.vercel.app` inspected as deployment `dpl_ohw2DUvovZqHdXKdzZeUPfZSEqC3`, status `Ready`, created immediately after local `HEAD` `b9dcc05`, and aliased to `https://dynastydegens.com`, `https://dynasty-degenerate.vercel.app`, and the main project aliases.
- Post-Home-threshold refresh: `https://dynasty-degenerate-9wnfprm72-billex87s-projects.vercel.app` inspected as deployment `dpl_9NEdma6k7r7wuReYbenJ4unj2dYs`, status `Ready`, created after `Home.tsx` dropped below the oversized-file threshold, and aliased to `https://dynastydegens.com`, `https://dynasty-degenerate.vercel.app`, and the main project aliases.
- Latest production smoke refresh: `npx --yes vercel@latest inspect dynastydegens.com` inspected `https://dynasty-degenerate-fhzp803gg-billex87s-projects.vercel.app` as deployment `dpl_6LzxMFJGdVRcnVNq7PUtVeheqGAv`, status `Ready`, created `Tue Jun 02 2026 07:24:06 GMT-0700`, and aliased to `https://dynastydegens.com`, `https://dynasty-degenerate.vercel.app`, and the main project aliases. `curl -I https://dynastydegens.com` returned `200` with `last-modified: Tue, 02 Jun 2026 14:38:43 GMT`.

## Cron State
- `vercel crons list` returned `12` cron jobs for production:
  - `/api/cron/dynamic-data-refresh` at `40 1 * * *`
  - `/api/cron/fantasypros-endpoint-snapshots` at `0 19 * * 2`
  - `/api/cron/fantasypros-endpoint-snapshots` at `0 20 * * 2`
  - `/api/cron/ktc-snapshot` at `0 15 * * *`
  - `/api/cron/ktc-snapshot` at `0 16 * * *`
  - `/api/cron/ktc-snapshot` at `0 23 * * *`
  - `/api/cron/ktc-snapshot` at `0 0 * * *`
  - `/api/cron/league-report-cache` at `20 15 * * *`
  - `/api/cron/league-report-cache` at `20 16 * * *`
  - `/api/cron/player-news-refresh` at `10 16 * * *`
  - `/api/cron/prospect-snapshot` at `0 14 1 * *`
  - `/api/cron/prospect-snapshot` at `0 15 1 * *`
- The CLI reported `6 local changes pending deploy` for cron schedule comparisons even though `vercel.json` contains the expected 12 cron entries and the latest deployment is Ready. Treat this as a Vercel CLI/project-state warning until verified in the dashboard.
- The pulled local `.vercel/.env.production.local` file contains the `CRON_SECRET` name but an empty value, so authorized production cron route calls were not run from this machine.
- Follow-up refresh still reports the same `6 local changes pending deploy` warning, but production lists the same 12 cron entries as `vercel.json`. Local `.vercel/output/config.json` is stale and shows older generated cron entries, so the current evidence points to a CLI/generated-output comparison artifact rather than missing production schedules. Dashboard confirmation is still required before removing this warning entirely.

## Runtime Logs
- Last-hour production error-level log query returned no entries.
- Last-hour production `500` status query returned no entries.
- Last-hour production cron query returned no entries.
- Follow-up refresh found no production `500` entries in the last two hours.
- Follow-up refresh found a production cron error log from `/api/cron/ktc-snapshot` on the previous production deployment. The cron returned `200` and stored the durable snapshot rows, but local diagnostic side writes tried to create files under `/var/task/server/ktc-snapshots` and `/var/task/.cache/api-provider-telemetry`, which is not a safe serverless write location.
- Local fix added after this finding: Vercel/serverless runs now skip local KTC snapshot files, API-provider telemetry JSONL files, and source-health JSONL files while preserving in-memory telemetry, database persistence, and source-health webhook behavior.
- Local verification for the fix: `pnpm exec vitest run server/localDiagnostics.test.ts` passed; current full `pnpm test` passed (`122` files, `608` passed, `1` skipped); `pnpm run check` passed; `pnpm build` passed.
- Post-deploy refresh for commit `dbeeea9` showed no new local API-provider telemetry write errors on that deployment, but did expose the same serverless write pattern in the league-report file-cache fallback: `writeFileCachedLeagueReport` tried to create `/var/task/.cache` while the durable database cache response still returned `200`.
- Second local fix added after that finding: Vercel/serverless runs now skip league-report local file-cache metadata/read/write/prune paths while preserving memory cache and durable database cache. Focused verification passed with `pnpm exec vitest run server/leagueReportCachePolicy.test.ts server/localDiagnostics.test.ts` and `pnpm run check`.
- Post-deploy refresh for commit `1adb905` passed production smoke across `Skids Get Beat`, `The Fantasy Degenerates`, `test league`, and `Gov Tech Grid Iron` after updating the smoke test to the current home-page username flow. Narrow post-smoke log queries showed live `league.analyze` traffic on deployment `dpl_CH8c3wuC6kwgs3Cmz8FjzpThXg2H` and no new `/var/task`, `Failed to write file league report cache`, `ApiProviderTelemetry`, or `500` entries in the post-deploy window.
- Post-smoke logs did show expected `[Auth] Missing session cookie` warnings for public report requests. Follow-up local fix now treats absent cookies as anonymous public requests without warning while preserving warnings for malformed/invalid session cookies. Focused verification passed with `pnpm exec vitest run server/auth.logout.test.ts server/leagueReportCachePolicy.test.ts server/localDiagnostics.test.ts` and `pnpm run check`.
- Final deployed refresh for commit `d3b1416` passed production smoke across all four representative leagues after removing stale smoke selectors for the current home-page heading, username `Find Leagues` flow, and global lazy-section loading text.
- Final post-smoke log checks for the current production deployment found no `/var/task`, `Failed to write file league report cache`, `Missing session cookie`, or `500` entries in the checked post-traffic window.
- Production env-name check confirmed `CRON_SECRET`, `JWT_SECRET`, `ADMIN_LOGIN_PASSWORD`, provider database names, FantasyPros API key, and projection feature flags are present and encrypted in Vercel production. `SOURCE_HEALTH_ALERT_WEBHOOK_URL` and `SOURCE_HEALTH_ALERT_WEBHOOK_MIN_LEVEL` are not configured in production yet.
- Responsive production smoke passed on `mobile-chrome` and `tablet-chrome` for `Skids Get Beat`, `The Fantasy Degenerates`, `test league`, and `Gov Tech Grid Iron`: `env -u NO_COLOR PRODUCTION_SMOKE=true PLAYWRIGHT_BASE_URL=https://dynastydegens.com pnpm exec playwright test tests/e2e/production-smoke.spec.ts --project=mobile-chrome --project=tablet-chrome` -> `8 passed`.
- Post-responsive-smoke log checks on deployment `dpl_AFqMDXkufYkeg2yXuUyUQVx4hMdP` found no `/var/task`, `Failed to write file league report cache`, `Missing session cookie`, or `500` entries in the checked window.
- Post-`18:40` Pacific cron-window checks were inconclusive for cron execution: bounded Vercel CLI queries for `dynamic-data-refresh`, `/api/cron/dynamic-data-refresh`, and generic `cron` returned no matching entries, while a general production log query did return normal report traffic. A production redeploy of commit `35f3377` started at `18:40:37` Pacific, overlapping the configured `40 1 * * *` `dynamic-data-refresh` cron minute, so this window cannot prove scheduled cron execution or skipped-cron behavior.
- The same post-window log pass found no matching entries for `/var/task`, `Failed to write file league report cache`, `Missing session cookie`, `500` responses, or error-level logs in the checked window.
- Latest Home-cleanup production smoke on deployment `dpl_ohw2DUvovZqHdXKdzZeUPfZSEqC3` passed all four representative leagues on desktop Chromium: `PRODUCTION_SMOKE=true PLAYWRIGHT_BASE_URL=https://dynastydegens.com pnpm exec playwright test tests/e2e/production-smoke.spec.ts --project=desktop-chrome` -> `4 passed`.
- Post-smoke log checks for deployment `dpl_ohw2DUvovZqHdXKdzZeUPfZSEqC3` found live `league.analyze` `200` traffic and no matching entries for error-level logs, `500` responses, `/var/task`, `Failed to write file league report cache`, `Missing session cookie`, or `ApiProviderTelemetry` in the checked `10m` window.
- Post-Home-threshold production smoke on deployment `dpl_9NEdma6k7r7wuReYbenJ4unj2dYs` passed all four representative leagues across mobile, tablet, and desktop Chromium: `PRODUCTION_SMOKE=true PLAYWRIGHT_BASE_URL=https://dynastydegens.com pnpm exec playwright test tests/e2e/production-smoke.spec.ts --project=desktop-chrome --project=mobile-chrome --project=tablet-chrome` -> `12 passed`.
- Post-smoke log checks for deployment `dpl_9NEdma6k7r7wuReYbenJ4unj2dYs` found live `league.analyze` `200` traffic and no matching entries for error-level logs, `500` responses, `/var/task`, `Failed to write file league report cache`, `Missing session cookie`, or `ApiProviderTelemetry` in the checked `15m` window.
- Latest production smoke on deployment `dpl_6LzxMFJGdVRcnVNq7PUtVeheqGAv` passed all four representative leagues across mobile, tablet, and desktop Chromium: `env -u NO_COLOR PRODUCTION_SMOKE=true PLAYWRIGHT_BASE_URL=https://dynastydegens.com pnpm exec playwright test tests/e2e/production-smoke.spec.ts --project=desktop-chrome --project=mobile-chrome --project=tablet-chrome` -> `12 passed`.
- Post-smoke log checks for deployment `dpl_6LzxMFJGdVRcnVNq7PUtVeheqGAv` returned no rows for error-level logs, `500` responses, or `/var/task` matches in the checked `10m` window: `npx --yes vercel@latest logs --environment production --since 10m --level error --json --limit 100`, `npx --yes vercel@latest logs --environment production --since 10m --status-code 500 --json --limit 100`, and `npx --yes vercel@latest logs --environment production --since 10m --query "/var/task" --json --limit 100`.
- Repeat confirmation on 2026-06-02 07:44 PDT: the same public production smoke command against `https://dynastydegens.com` passed `12`/`12` again across `Skids Get Beat`, `The Fantasy Degenerates`, `test league`, and `Gov Tech Grid Iron` on mobile, tablet, and desktop Chromium. The same three Vercel log queries for error-level rows, `500` responses, and `/var/task` matches returned no rows in the checked `10m` window.

## Usage And Metrics Availability
- `vercel metrics schema vercel.function --format json` confirmed the required metric IDs exist, including:
  - `vercel.function_invocation.function_cpu_time_ms`
  - `vercel.function_invocation.count`
  - `vercel.function_invocation.fot_total_bytes`
  - `vercel.function_invocation.peak_memory_mb`
  - `vercel.function_invocation.provisioned_memory_mb`
- Actual metric queries returned:
  - `payment_required`
  - `A subscription to Observability Plus is required`
- Follow-up CPU/count/peak-memory metric queries still returned `payment_required`, so route-level Fluid Active CPU, invocation totals, and peak memory remain unavailable from this CLI/API plan.
- `vercel usage --format json` returned:
  - `Costs not found (404)`

## Decision
- This pass proves production deployment health, production report traffic health, cron configuration visibility, and absence of recent visible runtime errors through the available CLI/log surfaces.
- This pass does not fully close the Vercel usage gate because Fluid Active CPU, function invocation totals, transfer, provisioned memory, and route-level CPU attribution are not accessible through the current CLI/API plan.
- The follow-up local-write fixes are deployed and clean for report traffic in the checked post-deploy windows. The `18:40` Pacific cron-window check did not show the old local-write errors, but it also did not prove cron execution because a same-commit production redeploy overlapped the scheduled minute.
- The latest Home-cleanup deployment is deployed and clean for representative desktop, tablet, and mobile report traffic, but this still does not prove scheduled cron execution or dashboard-only usage metrics.
- The latest production deployment is Ready and clean for representative public desktop, tablet, and mobile report traffic, but this still does not prove trusted fresh-generation, scheduled cron execution, or dashboard-only usage metrics.
- Critical auth/cron env names are present in production; source-health webhook delivery remains unconfigured.
- Do not mark the Vercel usage checklist item complete until one of these happens:
  - a Vercel dashboard/manual pass records Fluid Active CPU, memory, invocations, transfer, and route hotspots; or
  - Observability Plus/API metric access is enabled and the CLI metric commands above return usable data.

## Follow-up
- Manually check Vercel dashboard Usage and Functions after the latest traffic/deploy window.
- Confirm whether the cron schedule warning is a CLI diff artifact or a real deployment mismatch.
- Re-run production cron log checks after the next scheduled cron window that is not overlapped by deployment churn.
- If metrics become available, capture top routes for:
  - `/api/trpc/league.analyze`
  - `/api/trpc/league.rankings`
  - `/api/trpc/league.rankingsMeta`
  - `/api/trpc/league.rankingProfile`
  - `/api/cron/dynamic-data-refresh`
  - `/api/cron/league-report-cache`
  - `/api/cron/player-news-refresh`
