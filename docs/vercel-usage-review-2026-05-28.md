# Vercel Usage Review - 2026-05-28 (Ready-to-Fill Baseline)

## Scope
- Complete the production usage gate after a real report-viewing session and at least one cron window.
- Focus on Fluid Active CPU and route/path behavior tied to CPU/timing hotspots.

## Checklist
- Real traffic session completed:
  - Date/time: pending (local preflight only; production session not yet executed)
  - Representative leagues touched: pending
- Cron windows observed (manual dashboard pass pending):
  - `/api/cron/ktc-snapshot`
  - `/api/cron/league-report-cache`
  - `/api/cron/player-news-refresh`
  - `/api/cron/dynamic-data-refresh`
  - `/api/cron/fantasypros-endpoint-snapshots`
  - `/api/cron/prospect-snapshot`
  - Local preflight status (with `CRON_SECRET` present, production mode) completed 2026-05-28:
    - `ktc-snapshot`: `401` (no/invalid auth), `202` skipped out-of-window with reason `Snapshot only runs at 8:00 or 16:00 America/Vancouver`.
    - `league-report-cache`: `401` (no/invalid auth), `202` skipped out-of-window with reason `Cache warming only runs after 8:00 or 16:00 America/Vancouver snapshots`.
    - `prospect-snapshot`: `401` (no/invalid auth), `202` skipped out-of-window with reason `Prospect snapshot only runs on the first day of each month at 07:00 America/Vancouver`.
    - `fantasypros-endpoint-snapshots`: `401` (no/invalid auth), `202` skipped out-of-window with reason `FantasyPros endpoint snapshots only run Tue at 12:00 America/Vancouver`.
    - `player-news-refresh`: `401` (no/invalid auth), `200` with counts on authenticated call (`playerNewsCount=25`, `fantasyProsNewsCount=25`, `sportsDataIoNewsCount=0`).
    - `dynamic-data-refresh` (authenticated): request timeout while long-running in this environment.
      - Observed partial run logs before abort: KTC scrape pages were fetched; run later failed with DB error `response is too large (max is 67108864 bytes)` when reading cached report entries.
    - Follow-up: after the metadata-first payload retrieval change in `server/dynamicDataJobs.ts`, this cron should be re-run to confirm timeout/no `response is too large` behavior is resolved.

## Vercel Dashboard Values to Record
- Fluid Active CPU current:
- Fluid Active CPU monthly:
- Provisioned memory:
- Total invocations (window):
- Transfer:
- Routes with highest CPU (if available):
- Functions with highest invocations:
- Any throttled/skipped-cron signals:
- `cron` behavior (executed vs skipped, especially non-window calls):

## Runtime Behavior to Confirm
- Cached-report open path includes `reportCacheStatus: "hit"` when appropriate.
- `league.analyze` still attaches live Sleeper state while using cached report payloads.
- Cron skip responses remain cheap during non-window windows.
- No obvious surge in `league.rankings`/`league.rankingsMeta`/`league.rankingProfile` from normal cached paths.
- On production, confirm `dynamic-data-refresh` executes/aborts within your expected maintenance envelope since it is the highest-cost cron path.

## Source/Notes
- `docs/vercel-function-cpu-runbook.md`
- `docs/operations-readiness-pass-2026-05-28.md`

## Decision
- Manual dashboard review still required for actual production usage values and route/cpu attribution.
