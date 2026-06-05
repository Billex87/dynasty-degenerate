# Projection / SOS Production Readiness Runbook

Use this runbook after every projection/SOS deployment and before calling the rollout healthy in production.

## Scope

This runbook validates backend/data readiness only. It does not cover legal pages, broad UI/UX changes, or AI readout wording.

Normal user report loads must stay snapshot-backed for schedule, SOS, and projection data. Sleeper is the only live user-load dependency, and only for current league state such as rosters, matchups, submitted lineups, transactions, drafts, and players.

## Required Command

Run the automated readiness gate:

```sh
pnpm run readiness:projection-sos
```

By default this validates league `1312139584427012096`. To use another representative league:

```sh
PROJECTION_SOS_READINESS_LEAGUE_ID=<league-id> pnpm run readiness:projection-sos
```

The command runs:

- `pnpm run audit:source-freshness`
- `pnpm run verify:projection-sos -- --league-id=<league-id>`

Before enabling or advertising any provider-attributed projection claim, also run the source gate checks:

```sh
pnpm run audit:source-readiness-gates
pnpm run audit:zero-row-valuation-sources
CHECK_FANTASYPROS_EXPANDED=true CHECK_FANTASYPROS_PROJECTIONS=true pnpm run check:fantasypros
pnpm run probe:football-data-sources
```

These checks do not replace the projection/SOS readiness gate. They prove that blocked/research providers are still blocked, zero-row valuation sources are classified, and SportsDataIO/FantasyData package endpoints are only probed through metadata-only cron/admin paths.

## Required Pass Criteria

The run is production-ready only when all of these are true:

- Source freshness reports no stale, missing, warn, danger, or error rows for projection/SOS sources.
- `draftsharks-sos-v1` is loaded and not stale.
- `nfl-schedule-games-v1` is loaded and not stale.
- `player-projection-snapshots-v1` weekly rows are ready for the active scoring profiles.
- Sleeper matchup context probe passes for the target league: matchup IDs, paired opponent rosters, submitted starters, player-points row metadata, and stored projection coverage are present.
- Projection-off mode fails closed with weekly projections blocked, no stored projection claims, and schedule/value fallback preserved.
- Projection-on mode passes readiness with fresh projection, schedule, and mapping evidence.
- `playoffSchedulePlanning.managerPlans` and `playoffSchedulePlanning.actionItems` are present.
- Playoff action items include confidence, replacement targets, and affected players when applicable.
- Projection-off playoff confidence and action-item confidence stay capped to schedule/value context.
- `waiverIntelligence.priorityWaiverTargets` are present and include source-backed `next3`, `next6`, or playoff matchup-window evidence.

## Focused E2E Gate

After the backend readiness command passes, run the focused browser smoke before or after production deploy:

```sh
pnpm exec playwright test tests/e2e/projection-sos-command-center.spec.ts
```

Against production:

```sh
PLAYWRIGHT_BASE_URL=https://dynastydegens.com pnpm exec playwright test tests/e2e/projection-sos-command-center.spec.ts
```

Pass criteria:

- Projection/SOS enabled report shows source-backed schedule mechanics.
- Projection-disabled report hides projection claims but keeps fallback waiver content.
- Regular report viewers do not see raw SOS source-trace detail.
- Mobile, tablet, and desktop projects pass.

## Post-Deploy Live Payload Check

After Vercel production deploy, force-refresh one representative report and confirm the live payload has:

- HTTP `200`
- `weeklyProjectionDiagnostics.status = "ready"`
- `weeklyProjectionDiagnostics.rowCount > 0`
- `playoffSchedulePlanning.status = "ready"`
- `playoffSchedulePlanning.weeks` includes `15`, `16`, and `17`
- `playoffSchedulePlanning.managerPlans.length > 0`
- `playoffSchedulePlanning.actionItems.length > 0`
- action-item confidence is present and within `0..100`
- `waiverIntelligence.priorityWaiverTargets.length > 0`
- priority waiver targets include schedule-window evidence

If the response is a cache hit, the contract can still pass, but a release validation should also perform a forced refresh when source/schema changes were deployed.

## Failure Criteria

Treat any of these as a release blocker:

- DraftSharks SOS snapshot missing or stale.
- Normalized NFL schedule snapshot missing or stale.
- Weekly projection snapshots missing, stale, or not mapped to the active scoring profiles.
- Projection-off responses contain stored weekly projection claims.
- Projection-on responses lack lineup strength, redraft valuation, matchup previews, playoff plans, playoff action items, or waiver priority windows.
- Sleeper matchup context probe lacks matchup IDs, paired opponent rosters, submitted starters, player-points row metadata, or stored projection coverage for the target league.
- Playoff action items are missing confidence or exceed the projection-off fallback cap.
- Normal report loads require live non-Sleeper provider calls.

## Snapshot Source Boundaries

- DraftSharks has no normal user-load API dependency in this app. Use stored SOS snapshots only.
- FantasyPros API access can refresh approved snapshots, but FantasyPros projection-powered public claims stay blocked until endpoint rights, rate limits, and redistribution terms are approved.
- Sleeper weekly projections may be stored as snapshots, but user-facing projection mechanics still require the full readiness gate and feature flags.
- Schedule/projection/SOS refreshes belong in cron/admin refresh paths, not normal report-load paths.

## Rollback

Use the global kill switch first:

```sh
DISABLE_PROJECTION_FEATURES=true
```

If needed, disable the enabling flags as well:

```sh
ENABLE_PROJECTION_FEATURES=false
ENABLE_SLEEPER_PROJECTIONS=false
ENABLE_WEEKLY_PROJECTIONS=false
```

The expected rollback behavior is schedule/value fallback with no stored projection claims.
