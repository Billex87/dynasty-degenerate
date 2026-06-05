# Provider / Source / Legal Checkpoint - 2026-06-05

Scope: projection/SOS/source-readiness provider gates only. This is an evidence checkpoint, not legal approval.

## Commands Run

```sh
pnpm run audit:source-readiness-gates
pnpm run audit:zero-row-valuation-sources
CHECK_FANTASYPROS_EXPANDED=true CHECK_FANTASYPROS_PROJECTIONS=true pnpm run check:fantasypros
pnpm run probe:football-data-sources
pnpm run audit:source-readiness-gates -- --require-public-claim-ready
```

All commands were run with the local shell on Node `25.2.1`; the repo still warns that it wants Node `24.x`.

## Source Gate Result

- Total gates: 14
- Approved for snapshots: 3
- Approved for public claims: 0
- Research: 8
- Blocked: 3

Snapshot-approved only:

- `nfl-schedule-games-v1`
- `draftsharks-sos-v1`
- `sleeper-weekly-projections-v1`

The stricter public-claim preflight failed as expected:

```text
Validation errors:
- No source readiness gate is approved for public provider-attributed claims.
```

## FantasyPros Result

The latest expanded/projection check did not validate production use.

- `rankings:DRAFT` returned `429 Too Many Requests`.
- The script skipped all remaining endpoints after the first 429.
- `projections` did not run in the latest check.
- Earlier same-day research probes had returned projection rows, but that is not enough for production or public claims because normal cadence/rate limits are not validated.
- `WW` remains research-only until closer-to-season checks return non-zero rows.
- `targets` and `articles` remain blocked until package access returns `200` and usage terms are approved.

Current status: keep FantasyPros projections, `WW`, targets, articles, and provider-attributed recommendation copy blocked.

## SportsDataIO / FantasyData Result

The metadata probe confirmed no production package credentials are configured locally:

- `SPORTSDATAIO_API_KEY`: not configured
- `SPORTSDATA_IO_API_KEY`: not configured
- `FANTASYDATA_API_KEY`: not configured

Protected package endpoints reported `missing_config`.

The public docs/metadata candidate page was reachable with `200`, but docs reachability is not row coverage. Players, teams, schedule, injuries, depth charts, scoring, projections, usage/route fields, and news stay research-only until approved credentials, endpoint shape, rate limits, freshness, and player/team mapping are proven.

## Zero-Row Valuation Sources

Configured sources: 9

Zero-row sources: 3

- `futureLicensedRouteData`: `watch`
- `dynastyDealer`: `benchmark-only`
- `dynastyDegenCache`: `benchmark-only`

No active source was disabled or removed.

## Official Terms Evidence To Give Legal

- FantasyPros API access request page: https://support.fantasypros.com/hc/en-us/articles/49749297704475-How-do-I-request-access-to-the-FantasyPros-API
- FantasyPros API Terms of Use: https://api.fantasypros.com/public/v2/terms-of-use
- SportsDataIO Terms of Service: https://sportsdata.io/terms-of-service
- SportsDataIO developer product tiers: https://sportsdata.io/developers
- Sleeper API docs: https://docs.sleeper.com/
- Sleeper General Terms: https://support.sleeper.com/en/articles/5486620-general-terms-of-use
- GridIron Data product page: https://www.gridirondata.com/
- GridIron Data Terms of Service: https://www.gridirondata.com/pages/terms.html

Non-legal engineering read:

- FantasyPros public API terms are not enough for commercial/public provider-attributed projection claims without separate approval.
- SportsDataIO Discovery Lab is not licensed for commercial redistribution; commercial use needs an agreement.
- Sleeper public API remains acceptable for read-only live league state, but hidden account-level transactions remain blocked because the public API does not expose an approved account authorization path.
- GridIron Data cannot be integrated or publicly attributed until key/package access, row coverage, rate limits, subscribed-use rights, and attribution language are documented.

## Current Decision

No provider/source/legal gate can move to `approved-for-public-claim` today.

Allowed:

- Keep normal report loads snapshot-backed.
- Keep Sleeper as the only live user-load source for selected league state.
- Keep schedule/SOS/projection mechanics behind existing snapshot and readiness gates.
- Use provider names in admin diagnostics, source coverage, legal/attribution contexts, and internal traces.

Blocked:

- Public provider-attributed projection claims.
- Public provider-attributed SOS/news/usage/role claims without complete gate evidence.
- FantasyPros projection-powered lineup/matchup/redraft claims.
- FantasyPros `WW` waiver-priority use.
- FantasyPros targets/articles snapshots.
- SportsDataIO/FantasyData model inputs.
- GridIron Data integration.
- Sleeper hidden account-level transaction imports.

Next external actions:

- Ask FantasyPros for commercial/production API approval covering projections, rankings, news, targets/articles if needed, rate limits, caching/storage, redistribution, and attribution language.
- Ask SportsDataIO/FantasyData for package access and commercial redistribution terms for NFL fantasy projections, injuries, depth charts, news, usage/route fields, players, teams, and schedules.
- Ask legal/product to approve exact public wording before any provider-attributed claim ships.
- Re-review FantasyPros `WW`, projections, targets, injuries, and depth-chart package maturity in August 2026.
