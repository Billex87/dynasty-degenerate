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
