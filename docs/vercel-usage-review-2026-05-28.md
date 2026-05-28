# Vercel Usage Review - 2026-05-28 (Ready-to-Fill Baseline)

## Scope
- Complete the production usage gate after a real report-viewing session and at least one cron window.
- Focus on Fluid Active CPU and route/path behavior tied to CPU/timing hotspots.

## Checklist
- Real traffic session completed:
  - Date/time:
  - Representative leagues touched:
- Cron windows observed:
  - `/api/cron/ktc-snapshot`
  - `/api/cron/league-report-cache`
  - `/api/cron/player-news-refresh`
  - `/api/cron/dynamic-data-refresh`
  - `/api/cron/fantasypros-endpoint-snapshots`
  - `/api/cron/prospect-snapshot`

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

## Source/Notes
- `docs/vercel-function-cpu-runbook.md`
- `docs/operations-readiness-pass-2026-05-28.md`

## Decision
- Fill values above after dashboard review.
