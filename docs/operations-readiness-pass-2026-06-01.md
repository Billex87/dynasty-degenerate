# Operations Readiness Pass - 2026-06-01

## Scope
- Final ship-readiness data/source freshness review after the launch audit implementation and R-008 API-warning follow-up.
- Read-only checks only: source freshness, league report cache freshness, source coverage, source-health events, and provider telemetry.
- No app code, report UI, cache rows, provider snapshots, or production data were modified in this pass.

## Commands Run
- `pnpm audit:source-freshness`
- `pnpm audit:league-report-cache`
- `pnpm audit:operations-readiness`

## Results

### Source Freshness
- Generated: `2026-06-01T20:32:43.248Z`
- Sources: `72`
- Status: `20 loaded, 46 stale, 6 missing, 0 error`
- Levels: `26 info, 46 warn, 0 danger`
- Stored payload: `48 MB`
- Oldest loaded source: Devy source snapshot `devy_sf_ppr_tep_0_5` at `17d 24h`.
- Notes: stale families remain Devy snapshots and FantasyPros weekly ECR endpoint rows. No source-health errors or danger rows were present.

### League Report Cache
- Generated: `2026-06-01T20:32:42.985Z`
- Serving TTL: `72h`
- Rows: `325 total`, `26 fresh`, `299 stale`
- Stored payload: `200 MB`
- Latest cache update: `2026-06-01T12:11:38.035Z` (`8h 21m` ago)
- Recent analyze activity: `167` attempts / `164` cache hits / `3` fresh uncached successes / `0` errors (`98%` hit rate).
- Notes: user-facing report loads are cache-healthy in the latest window. The cache fleet is still mostly stale because there are no warm leagues configured and many old report/ranking rows remain outside the 72-hour serving window.

### Unified Operations Readiness
- Generated: `2026-06-01T20:32:43.308Z`
- Source coverage matrix: `31` total, `15 loaded`, `6 stale`, `6 missing`, `1 blocked`, `3 research`
- Needs approval: `6`
- Source-health events in 14-day lookback: `40`
- Event levels: `danger=0`, `warn=16`, `info=24`
- Provider telemetry: `Calls=22543`, `network=22541`, `failures=784`, `429s=0`
- Top providers: `Sleeper=22514`, `FantasyPros=29`
- Top failing families remain Sleeper league/roster lookups from historical telemetry. No rate-limit events were recorded.

## Decision
- This data/source freshness gate is closed for launch-readiness purposes because there are no source errors, no danger health events, no 429s, no recent report-generation errors, and recent report traffic is served with a `98%` cache hit rate.
- The stale and missing source families are accepted limitations for this release, not blockers:
  - Devy/prospect snapshots are stale and should remain lower-confidence until refreshed.
  - FantasyPros weekly ECR endpoint snapshots are stale; projection-specific and weekly-rank claims must stay gated by source freshness and source-policy checks.
  - DraftSharks SOS, player props, SportsDataIO/RotoBaller news, FantasyPros projections, NFL Draft Buzz, Flock, Yahoo/Fantrax/FFPC, and other blocked/research sources remain non-critical or approval-gated.
- The app should continue to avoid implying certainty where source coverage is stale, missing, blocked, or research-only.

## Remaining Follow-up
- Run the separate Vercel production usage review after a real traffic window and cron cycle.
- Confirm production source-health alert webhook configuration in the operations/security pass.
- Add warm leagues only after reviewing Vercel Fluid Active CPU and cron behavior.
- Re-run this readiness pass after provider refresh jobs or source approvals change.
