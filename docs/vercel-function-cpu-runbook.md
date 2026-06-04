# Vercel Function CPU Runbook

Last updated: 2026-05-27

## Goal

Keep Vercel Hobby `Fluid Active CPU` usage under control without hiding errors,
removing report behavior, or caching private/user-specific responses.

Primary metric:

- `vercel-functions-fluid-cpu-duration`
- Vercel dashboard label: `Fluid Active CPU`

## Current CPU-Reduction Patch

The current patch reduces unnecessary active CPU in several places:

- Cached report opens keep live Sleeper activity, but no longer precompute value
  profiles for the full Sleeper player index.
- `league.analyze` no longer treats `liveRefresh: true` as a full report-cache
  bypass. A valid cached report should return `reportCacheStatus: "hit"` while
  still attaching live Sleeper activity.
- Rankings cache misses reuse the existing one-hour Sleeper player-index cache.
- KTC/value snapshots do real work only at 8 AM and 4 PM Pacific. Vercel cron
  entries cover both daylight and standard UTC offsets, and the handler skips
  off-window invocations cheaply.
- `/api/cron/league-report-cache` is guarded by the same 8 AM / 4 PM Pacific
  window and skips fresh report caches by default. When the report cache is
  fresh, it now also skips the separate rankings warmup unless the authorized
  request uses `?rankings=true` or
  `LEAGUE_REPORT_WARM_RANKINGS_ON_HIT=true`.
- `/api/cron/player-news-refresh` runs once per day and persists the latest
  provider-backed player-news snapshot for modal/readout use.
- Manual authorized `?force=true` still bypasses the report and rankings caches
  on routes that support it.

## Current Cron Schedule

Vercel cron expressions are UTC. Runtime handlers use Pacific-time guards so
backup UTC entries do not all do expensive work.

- `/api/cron/ktc-snapshot`
  - `0 15 * * *`
  - `0 16 * * *`
  - `0 23 * * *`
  - `0 0 * * *`
  - Real work: 8 AM and 4 PM `America/Vancouver`.
- `/api/cron/league-report-cache`
  - `20 15 * * *`
  - `20 16 * * *`
  - Real work: morning Pacific warmer only when the handler's time guard allows
    it and warm leagues are configured.
- `/api/cron/player-news-refresh`
  - `10 16 * * *`
  - Real work: daily player-news snapshot refresh.
- `/api/cron/dynamic-data-refresh`
  - `40 1 * * *`
- `/api/cron/prospect-snapshot`
  - `0 14 1 * *`
  - `0 15 1 * *`
- `/api/cron/fantasypros-endpoint-snapshots`
  - `0 19 * * 2`
  - `0 20 * * 2`

## Post-Deploy Check

Latest production usage note:

- 2026-06-04: see [vercel-usage-review-2026-06-04.md](vercel-usage-review-2026-06-04.md). Production alias was Ready and served `HTTP/2 200`; env names and cron schedule were checked without printing secrets. `vercel usage` and `vercel logs` did not return output before a bounded guard stopped them, so dashboard-only CPU/log evidence remains open.

After deploying the patch, wait for at least one scheduled cron window and one
normal report-viewing session, then check Vercel usage.

First run the local DB/cache audit:

```bash
pnpm audit:ops-security
pnpm audit:league-report-cache
pnpm audit:source-freshness
```

Record:

- operations security pass/warn/blocker counts
- whether source-health alert delivery is configured or intentionally deferred
- cache rows, fresh rows, and stale rows
- stored payload bytes
- latest cache update age
- last 24h analyze cache-hit rate
- whether warm leagues are configured
- source freshness totals, especially stale/missing/error counts
- oldest loaded source and any recent source-health warnings/errors

In Vercel:

- Open project dashboard.
- Review Usage for `Fluid Active CPU`.
- If route/function breakdown is available, compare these paths:
  - `/api/cron/league-report-cache`
  - `/api/trpc/league.analyze`
  - `/api/trpc/league.rankings`
  - `/api/trpc/league.rankingsMeta`
  - `/api/trpc/league.rankingProfile`
  - `/api/cron/dynamic-data-refresh`
  - `/api/cron/player-news-refresh`

Record:

- Date/time checked.
- Current `Fluid Active CPU` used and monthly limit.
- Top function paths by CPU, if visible.
- Whether `/api/cron/league-report-cache` reports mostly `reportCacheStatus:
  "hit"` or `reportCacheStatus: "warmed"` in logs/responses.
- Whether skipped cron responses are cheap `202` responses outside their
  Pacific windows.

## Freshness And Retention Thresholds

The source freshness audit is read-only. It reads stored snapshot metadata and
source-health events, then reports stale/missing/error sources without calling
live providers.

```bash
pnpm audit:source-freshness
```

Default expected freshness:

| Source family | Expected freshness | CPU note |
| --- | ---: | --- |
| KTC/value snapshot | 36 hours | Real cron work is limited to 8 AM and 4 PM Pacific. |
| Redraft source snapshot | 36 hours | Keep stored-snapshot reads out of report hot paths. |
| FantasyPros news | 36 hours | Missing is only a warning when the API key and news feature are enabled. |
| FantasyPros weekly ECR, waiver, projections, player points | 36 hours | Endpoint snapshots should be reused from storage, not refetched on report open. |
| FantasyPros players and compare players | 7 days | Treat these as slower-moving metadata snapshots. |
| SportsDataIO/RotoBaller news | 36 hours | Player modals should reuse the stored news snapshot. |
| Sleeper weekly projections | 36 hours | Keep projection refreshes behind the snapshot job. |
| ESPN depth charts and DraftSharks SOS | 7 days | DraftSharks remains the approved SOS source boundary. |
| nflverse usage, injuries, team environment, season stats | 90 days | Historical context can be long-lived and should not refresh on user load. |
| nflverse roster room | 7 days | Use stored roster-room deltas for player situation readouts. |
| nflverse combine and contracts | 45 days | Slow-moving context; avoid frequent refreshes. |
| prospect snapshots | 45 days | Monthly cadence is enough unless draft-content requirements change. |

Cache cleanup thresholds:

| Cache family | Keep | Review trigger |
| --- | --- | --- |
| `league-report-v56` | current report cache version | delete only stale older versions after dry-run review |
| `league-rankings-v13` | current rankings cache version | delete only stale older versions after dry-run review |
| Fresh report cache rows | normal serving TTL from `server/leagueReportCachePolicy.ts` | do not compact/delete fresh rows just to reduce storage |
| Stale old-version rows | eligible for dry-run cleanup | review row count and payload bytes before live deletion |

## Quick Verification Commands

Use these when validating a CPU-focused change:

```bash
pnpm audit:ops-security
pnpm test server/leagueReportCacheDecision.test.ts server/pacificCronWindows.test.ts server/leagueReportCachePolicy.test.ts server/fantasyProsEndpointSnapshotSchedule.test.ts
pnpm test server/sourceFreshnessSummary.test.ts server/sourceSnapshotFreshness.test.ts
pnpm run check
pnpm audit:league-report-cache
pnpm audit:source-freshness
```

Do not manually invoke cron routes in production just to test them unless you
intend to run the job. Prefer checking scheduled logs after the next window.

## Decision Tree

If `/api/cron/league-report-cache` is still a top CPU user:

- Confirm `LEAGUE_REPORT_WARM_LEAGUE_IDS` only includes leagues worth warming.
- Confirm authorized scheduled calls are not using `?rankings=true` unless the
  extra rankings warmup is intentional.
- Consider disabling the scheduled warmer and relying on on-demand report loads.
- Keep manual authorized `?force=true` for one-off prewarming.

## Risky CPU Issues Left Untouched

- Auth-context laziness was left untouched because it affects protected/admin
  procedure behavior.
- Vercel handler splitting was left untouched because it changes deployment and
  cold-start structure across all API shims.
- Viewer-specific report payload caching was left untouched because report output
  can depend on viewer/admin context.
- Broad CDN caching was left untouched because `/api/trpc` mixes public,
  private, admin, cookie-backed, batched, query, and mutation traffic.

If `/api/trpc/league.analyze` is still a top CPU user:

- Split cached report opens from fresh report generation in the logs.
- Preserve live Sleeper recent transactions/trending behavior.
- Confirm cached report opens log `Served cached league report with requested
  live Sleeper activity` when `liveRefresh: true`.
- Confirm `pnpm audit:league-report-cache` shows a healthy hit rate before
  changing report-generation behavior.
- Look for more full-player-index scans or repeated value/ranking transforms in
  the cached-hit path before changing freshness behavior.

If rankings endpoints are still top CPU users:

- Check whether the UI is requesting multiple ranking profiles on initial load.
- Keep metadata/detail split intact.
- Avoid reintroducing full ranking payloads into cached report transfer.

If `/api/cron/dynamic-data-refresh` is top CPU:

- Check enabled feature flags before changing code.
- Prefer reducing optional snapshot/health work cadence over removing diagnostics.

If `/api/cron/player-news-refresh` is top CPU:

- Keep it at once per day unless there is a product reason to increase cadence.
- Check provider row counts and duration in logs before adding additional news
  sources.
- Prefer improving snapshot reuse in player details over calling providers on
  modal open.

## Do Not Do Without Review

- Do not add broad CDN caching to `/api/trpc`; the surface mixes public,
  private, admin, cookie-backed, batched, query, and mutation traffic.
- Do not cache personalized, authenticated, admin, or private responses.
- Do not remove live Sleeper activity refresh from cached report opens unless
  the product freshness tradeoff is explicitly accepted.
- Do not stage unrelated dirty files with this operational patch.
