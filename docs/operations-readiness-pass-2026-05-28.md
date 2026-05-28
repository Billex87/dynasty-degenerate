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
- Generated: `2026-05-28T16:35:44.346Z`
- Sources: `72`
- Status: `21 loaded, 45 stale, 6 missing, 0 error`
- Notes: largest stale families remain Devy snapshots and FantasyPros weekly ECR; no new source-health error families in this window.

### League Report Cache
- Generated: `2026-05-28T16:35:44.609Z`
- Rows: `311 total`, `76 fresh`, `235 stale`
- Stored payload: `191 MB`
- Latest cache update: `2026-05-28T00:52:27.868Z` (`15h 43m` ago)
- Recent analyze activity: `57` attempts / `45` hits / `11` fresh / `1` error (`79%` hit rate).
- Notes: one recent error was `Invalid league ID`; appears limited to bad input/invalid league request.

### Unified Operations Readiness
- Generated: `2026-05-28T16:35:44.922Z`
- Source coverage matrix: `31` total, `16 loaded`, `5 stale`, `6 missing`, `1 blocked`, `3 research`
- Needs approval: `6`
- Provider telemetry (14-day): `Calls=22040`, `network=22039`, `failures=958`, `429s=0`
- Top providers: `Sleeper=22020` (main surface), `FantasyPros=20`.
- Notes: stale/missing sources and missing coverage remain expected from existing backlog in non-critical feature paths.

## Decision
- This run is captured as the latest baseline before the next refactor iteration.
- Vercel production usage review and webhook env-hardening still remain in follow-up scope (no dashboard snapshot captured in this pass).
