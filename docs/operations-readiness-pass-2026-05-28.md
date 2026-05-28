# Operations Readiness Pass - 2026-05-28

## Scope
- Post-refactor safety pass on Spark after frontend/backend route refactor pause.
- Non-invasive checks only: source freshness, league report cache freshness, and unified operations snapshot.

## Commands Run
- `pnpm audit:source-freshness`
- `pnpm audit:league-report-cache`
- `pnpm audit:operations-readiness`

## Results

### Source Freshness
- Generated: `2026-05-28T18:34:29.071Z`
- Sources: `72`
- Status: `21 loaded, 45 stale, 6 missing, 0 error`
- Notes: stale families remain Devy snapshots and FantasyPros weekly ECR (unchanged from previous run); no source-health error families in this snapshot.

### League Report Cache
- Generated: `2026-05-28T18:34:31.799Z`
- Rows: `311 total`, `71 fresh`, `240 stale`
- Stored payload: `191 MB`
- Latest cache update: `2026-05-28T00:52:27.868Z` (`17h 42m` ago)
- Recent analyze activity: `34` attempts / `25` hits / `9` fresh / `0` errors (`74%` hit rate).
- Notes: no fresh-analysis errors in this run; cache recency and coverage still indicate a partially stale fleet.

### Unified Operations Readiness
- Generated: `2026-05-28T18:34:34.879Z`
- Source coverage matrix: `31` total, `16 loaded`, `5 stale`, `6 missing`, `1 blocked`, `3 research`
- Needs approval: `6`
- Provider telemetry (14-day): `Calls=22040`, `network=22039`, `failures=958`, `429s=0`
- Top providers: `Sleeper=22020` (main surface), `FantasyPros=20`.
- Notes: stale/missing sources and missing coverage remain expected from existing non-critical backlog; no source-health danger events in this window.

## Decision
- This run is captured as the latest baseline before the next refactor iteration.
- Vercel production usage review and webhook env-hardening still remain in follow-up scope (no dashboard snapshot captured in this pass).
- A local code-path hardening change was applied after this baseline to reduce `dynamic-data-refresh` DB read pressure: it now reads cache metadata first, skips overly-large payload rows, then fetches payloads individually.

## Post-Hardening Re-run (local)
- Timestamp: `2026-05-28T19:35:23.086Z`
- Source freshness unchanged at this check:
  - Sources: `72`
  - Status: `21 loaded, 45 stale, 6 missing, 0 error`
  - Major stale families remain Devy + FantasyPros weekly ECR.
- Cache freshness unchanged:
  - Rows: `311`, fresh: `71`, stale: `240`, stored: `191 MB`
  - Latest cache update: `2026-05-28T00:52:27.868Z` (`18h 42m` ago)
  - Analyze activity: `29` attempts / `20` hits / `9` fresh / `0` errors (`69%` hit rate).
- Operations readiness snapshot:
  - Source coverage matrix: `31` total, `16 loaded`, `5 stale`, `6 missing`, `1 blocked`, `3 research`
  - Provider telemetry: `Calls=22074`, `network=22072`, `failures=958`, `429s=0`
  - Top providers: `Sleeper=22045`, `FantasyPros=29`.
- Interpretation: this does not resolve cron-runtime behavior by itself; it confirms read-path health after the hardening change.
- Additional local runtime smoke (production-shaped): `runDynamicDataRefresh({ backfillLimit: 10 })` completed at `2026-05-28T19:46:39Z` with `ok=true`, `durationMs=14133`, and no `response is too large` failure.
- Remaining risk: full production-window cron execution is still required to confirm scheduling and execution envelope under real runtime.
