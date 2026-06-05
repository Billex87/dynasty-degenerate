# SportsDataIO/FantasyData Endpoint Audit

Audit date: June 5, 2026

Command:

```bash
pnpm run probe:football-data-sources
```

## Gate Decision

Status: `research`

Do not wire SportsDataIO/FantasyData players, teams, schedule, injury, depth-chart, scoring, projection, route/usage, or news fields into report generation, lineup/matchup reads, waiver recommendations, trade recommendations, rankings, or public provider-attributed claims until package access, terms, endpoint shape, row counts, freshness, rate limits, and player mapping are documented as approved.

The probe is metadata-only. It does not print credentials or payload rows, and it does not allow normal report-load provider calls.

## June 5 Probe Evidence

Credential state:

| Env Var | Configured |
| --- | --- |
| `SPORTSDATAIO_API_KEY` | No |
| `SPORTSDATA_IO_API_KEY` | No |
| `FANTASYDATA_API_KEY` | No |

Protected API probes were skipped with `missing_config`, so there is no current row-count, freshness, rate-limit, package-access, or mapping evidence for production use.

| Probe | Category | Candidate Path | Status | Current Decision |
| --- | --- | --- | --- | --- |
| `sportsdataio-players` | players | `/v3/nfl/scores/json/Players` | `missing_config` | Useful for provider player-ID mapping only after approved package access. |
| `sportsdataio-teams` | teams | `/v3/nfl/scores/json/Teams` | `missing_config` | Useful for team-code joins only after approved package access. |
| `sportsdataio-schedule` | schedule | `/v3/nfl/scores/json/Schedules/2026` | `missing_config` | Potential schedule snapshot candidate, but not approved as production schedule source. |
| `sportsdataio-injuries` | injuries | `/v3/nfl/scores/json/Injuries/2026REG/1` | `missing_config` | Role/confidence input stays blocked until live rows and freshness windows are proven. |
| `sportsdataio-depth-charts` | depth charts | `/v3/nfl/scores/json/DepthCharts` | `missing_config` | Depth-chart change detection stays source-gated. |
| `sportsdataio-weekly-projections` | projections | `/v3/nfl/projections/json/PlayerGameProjectionStatsByWeek/2026REG/1` | `missing_config` | Public projection, lineup, and matchup usage stays blocked. |
| `sportsdataio-scoring-fields` | scoring | `/v3/nfl/stats/json/PlayerGameStatsByWeek/2026REG/1` | `missing_config` | Backtest/scoring use stays blocked until scoring semantics and package rows are confirmed. |
| `sportsdataio-route-usage-candidate` | usage/route fields | `https://sportsdata.io/developers/workflow-guide/nfl` | `200`, `text/html`, 910,865 bytes | Docs metadata only. It matched `Depth Charts`, `Projections`, and `Fantasy Points`; it did not prove exact route, route share, YPRR, first-read, or package row coverage. |
| `sportsdataio-news` | news | `/v3/nfl/scores/json/News` | `missing_config` | Existing news snapshot path remains research/snapshot-only until package access, rate limits, and mapping pass. |

## Feature Use Decision

Potentially useful after approvals:

- player/team identity mapping for projection, news, injury, schedule, and depth-chart joins
- full schedule snapshots if source/legal approval beats or supplements the current approved export path
- injury and depth-chart change detection
- weekly projection snapshots for lineup strength, matchup preview, redraft support, and projection backtests
- fantasy scoring/stat rows for historical grading and scoring-profile normalization
- news snapshots as a secondary injury/context source

Still not proven:

- current-season non-zero rows
- package entitlement for each endpoint family
- normal rate limits and safe cron cadence
- freshness timestamps by endpoint
- player mapping coverage to Sleeper/GSIS/FantasyPros IDs
- exact route-volume fields such as routes run, route share, targets per route run, yards per route run, or first-read share
- attribution language or redistribution rights

## Open Requirements Before Integration

- approved commercial/package access for each endpoint family
- endpoint contracts and response shapes captured without storing raw secret-bearing payloads
- non-zero current-season row counts across positions and teams
- source freshness timestamp or response date semantics
- rate-limit result under expected cron/admin probe cadence
- provider player/team ID mapping to Sleeper/GSIS and internal team codes
- approved attribution language for SportsDataIO, FantasyData, RotoBaller, and any upstream licensed data
- explicit confirmation that normal report loads remain snapshot-backed
