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
- The follow-up local-write fixes are deployed and clean for report traffic in the checked post-deploy window. The next remaining production-log confirmation is the next scheduled cron window.
- Do not mark the Vercel usage checklist item complete until one of these happens:
  - a Vercel dashboard/manual pass records Fluid Active CPU, memory, invocations, transfer, and route hotspots; or
  - Observability Plus/API metric access is enabled and the CLI metric commands above return usable data.

## Follow-up
- Manually check Vercel dashboard Usage and Functions after the latest traffic/deploy window.
- Confirm whether the cron schedule warning is a CLI diff artifact or a real deployment mismatch.
- Re-run production cron log checks after the next scheduled cron window.
- If metrics become available, capture top routes for:
  - `/api/trpc/league.analyze`
  - `/api/trpc/league.rankings`
  - `/api/trpc/league.rankingsMeta`
  - `/api/trpc/league.rankingProfile`
  - `/api/cron/dynamic-data-refresh`
  - `/api/cron/league-report-cache`
  - `/api/cron/player-news-refresh`
