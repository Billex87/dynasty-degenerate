# Vercel Function CPU Runbook

Last updated: 2026-05-25

## Goal

Keep Vercel Hobby `Fluid Active CPU` usage under control without hiding errors,
removing report behavior, or caching private/user-specific responses.

Primary metric:

- `vercel-functions-fluid-cpu-duration`
- Vercel dashboard label: `Fluid Active CPU`

## Current CPU-Reduction Patch

The current patch reduces unnecessary active CPU in three places:

- Cached report opens keep live Sleeper activity, but no longer precompute value
  profiles for the full Sleeper player index.
- Rankings cache misses reuse the existing one-hour Sleeper player-index cache.
- `/api/cron/league-report-cache` runs once per day and skips fresh report
  caches by default. Manual authorized `?force=true` still bypasses the cache.

## Post-Deploy Check

After deploying the patch, wait for at least one scheduled cron window and one
normal report-viewing session, then check Vercel usage.

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

Record:

- Date/time checked.
- Current `Fluid Active CPU` used and monthly limit.
- Top function paths by CPU, if visible.
- Whether `/api/cron/league-report-cache` reports mostly `reportCacheStatus:
  "hit"` or `reportCacheStatus: "warmed"` in logs/responses.

## Decision Tree

If `/api/cron/league-report-cache` is still a top CPU user:

- Confirm `LEAGUE_REPORT_WARM_LEAGUE_IDS` only includes leagues worth warming.
- Consider disabling the scheduled warmer and relying on on-demand report loads.
- Keep manual authorized `?force=true` for one-off prewarming.

If `/api/trpc/league.analyze` is still a top CPU user:

- Split cached report opens from fresh report generation in the logs.
- Preserve live Sleeper recent transactions/trending behavior.
- Look for more full-player-index scans or repeated value/ranking transforms in
  the cached-hit path before changing freshness behavior.

If rankings endpoints are still top CPU users:

- Check whether the UI is requesting multiple ranking profiles on initial load.
- Keep metadata/detail split intact.
- Avoid reintroducing full ranking payloads into cached report transfer.

If `/api/cron/dynamic-data-refresh` is top CPU:

- Check enabled feature flags before changing code.
- Prefer reducing optional snapshot/health work cadence over removing diagnostics.

## Do Not Do Without Review

- Do not add broad CDN caching to `/api/trpc`; the surface mixes public,
  private, admin, cookie-backed, batched, query, and mutation traffic.
- Do not cache personalized, authenticated, admin, or private responses.
- Do not remove live Sleeper activity refresh from cached report opens unless
  the product freshness tradeoff is explicitly accepted.
- Do not stage unrelated dirty files with this operational patch.
