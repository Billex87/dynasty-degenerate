# Projection / SOS Preview Rollout Checklist

Use this checklist for Vercel Preview or another staging-like target before enabling projection-backed mechanics in production. Do not use it to turn on production user-facing projection claims directly.

## Scope

This rollout is limited to projection/SOS backend readiness, source freshness, report safety, and focused e2e coverage.

Do not include:

- legal page changes
- AI readout wording changes
- broad UI/UX redesign work
- production FantasyPros projection claims before source rights and rate limits are approved

## Preview Environment Flags

Set these only on the Preview/staging target first:

```sh
ENABLE_DRAFTSHARKS_SOS=true
ENABLE_PROJECTION_FEATURES=true
ENABLE_SLEEPER_PROJECTIONS=true
ENABLE_WEEKLY_PROJECTIONS=true
```

Snapshot refresh jobs can also use:

```sh
ENABLE_SLEEPER_PROJECTION_SNAPSHOTS=true
ENABLE_FANTASYPROS_ENDPOINT_SNAPSHOTS=true
ENABLE_FANTASYPROS_EXPANDED_SNAPSHOTS=true
```

Keep these off unless entitlement is confirmed:

```sh
ENABLE_FANTASYPROS_PROJECTIONS=false
ENABLE_FANTASYPROS_TARGETS_SNAPSHOTS=false
ENABLE_FANTASYPROS_ARTICLES_SNAPSHOTS=false
```

`FANTASYPROS_API_KEY` may be configured for approved FantasyPros endpoint snapshots, but FantasyPros projection-powered public claims stay blocked until commercial terms, endpoint rights, and rate limits are approved.

## Data Refresh Before Preview Enablement

Run the source refresh/audit path from a production-like environment or against the same data store the Preview target will read:

```sh
pnpm run check:fantasypros
pnpm run audit:source-readiness-gates
pnpm run audit:zero-row-valuation-sources
pnpm run probe:football-data-sources
pnpm run probe:external-sources
pnpm run refresh:sleeper-projections -- --season=2026 --profiles=PPR,HALF_PPR,STD --write
pnpm run audit:source-freshness
```

Pass criteria:

- DraftSharks SOS snapshot is loaded and not stale.
- `nfl-schedule-games-v1` is loaded and not stale.
- `player-projection-snapshots-v1:sleeper:PPR:weekly`, `HALF_PPR`, and `STD` are loaded and not stale.
- Missing rows are limited to optional or unapproved sources and report as `info`, not `warn` or `danger`.
- Normal report loads still use snapshots for schedule, SOS, and projections.
- Sleeper remains the only live normal user-load dependency, and only for league current state.
- SportsDataIO/FantasyData and FantasyPros blocked/research gates stay out of public projection claims unless the source-readiness gate register explicitly approves them.
- Zero-row valuation sources are classified as fix/watch/disable/benchmark-only before any weight or model change consumes them.

## Local Safety Proof

Run these before enabling the Preview flags:

```sh
pnpm run verify:projection-sos-rollout
pnpm run audit:source-freshness
pnpm run validate:report
pnpm exec playwright test tests/e2e/projection-sos-command-center.spec.ts
```

Pass criteria:

- `verify:projection-sos-rollout` confirms projection-off fail-closed behavior and projection-on readiness.
- `audit:source-freshness` has no stale, error, warn, or danger projection/SOS rows.
- `validate:report` passes semantic audit, typecheck, and report test coverage.
- Projection/SOS e2e passes for mobile, tablet, and desktop.

## Preview Browser Proof

After Preview deployment and Preview env flags are set, run the focused e2e spec against the deployed URL:

```sh
PLAYWRIGHT_BASE_URL=<preview-url> pnpm exec playwright test tests/e2e/projection-sos-command-center.spec.ts --project=desktop-chrome
```

If desktop passes and the Preview target is stable, run the full responsive matrix:

```sh
PLAYWRIGHT_BASE_URL=<preview-url> pnpm exec playwright test tests/e2e/projection-sos-command-center.spec.ts
```

Pass criteria:

- Projection-enabled fixture surfaces stored projection mechanics.
- Projection-disabled fixture strips projection claims and keeps schedule/value fallback copy.
- Regular viewer paths do not expose raw source trace details.
- No provider is called live during normal report loads except Sleeper league state.

## Rollback

Use the global kill switch first:

```sh
DISABLE_PROJECTION_FEATURES=true
```

If a target does not support kill-switch-only rollback cleanly, remove or set these flags to false:

```sh
ENABLE_PROJECTION_FEATURES=false
ENABLE_SLEEPER_PROJECTIONS=false
ENABLE_WEEKLY_PROJECTIONS=false
```

Snapshot refresh flags can remain enabled only if they are cron/admin-only, source-approved, and not creating public projection claims.

## Production Promotion Gate

Do not promote to production until this evidence exists:

- Preview rollout checklist passed.
- Projection-off and projection-on modes were both verified.
- Source freshness shows no projection/SOS `warn` or `danger` rows.
- Report validation passed after the latest snapshot refresh.
- Preview e2e passed against the deployed Preview URL.
- Rollback was confirmed by toggling projection features off and observing schedule/value fallback behavior.

Production should enable only the minimum safe set first:

```sh
ENABLE_DRAFTSHARKS_SOS=true
ENABLE_PROJECTION_FEATURES=true
ENABLE_SLEEPER_PROJECTIONS=true
ENABLE_WEEKLY_PROJECTIONS=true
```

Keep FantasyPros projection flags off until approved for production user-facing projection claims.
