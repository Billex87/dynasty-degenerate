# Projection Source Readiness Gates

This register controls when projection, SOS, schedule, news, usage, and provider-derived signals can move from research to stored snapshots to public claims.

Normal report loads remain snapshot-backed. Sleeper is the only live user-load source, and only for selected league state such as rosters, users, drafts, matchups, submitted lineups, transactions, trends, and players.

## Status Meanings

| Status | Meaning |
| --- | --- |
| `blocked` | Do not call for production snapshots, weight in models, use during normal report loads, or present in production features until package/legal/source evidence changes. Only explicit metadata-only probes listed below are allowed. |
| `research` | Metadata-only audit/probe is allowed. Do not consume rows in user-facing models yet. |
| `approved-for-snapshot` | Cron/admin/manual snapshot use is allowed. Normal report loads read stored snapshots only. |
| `approved-for-public-claim` | Public provider-attributed claims are allowed only after every evidence field is complete. No current projection source has this status. |

## Required Evidence Before Public Claims

Every source needs the same evidence before provider-attributed projection, schedule, news, usage, or role claims can be public:

- terms approval
- exact endpoint URL/path or snapshot storage key
- auth model
- row count
- freshness timestamp
- rate-limit result
- player/team/scoring mapping coverage
- allowed attribution language

## Current Gate Register

| Gate | Status | Normal load | Public claim | Required next action |
| --- | --- | --- | --- | --- |
| Full NFL schedule snapshot | `approved-for-snapshot` | Snapshot only | No | Keep source/version evidence attached to every new `nfl-schedule-games-v1` snapshot. |
| DraftSharks SOS snapshot | `approved-for-snapshot` | Snapshot only | No | Keep weekly/manual snapshot evidence and stale-row fallback visible in source freshness. |
| Sleeper weekly projection snapshots | `approved-for-snapshot` | Snapshot only | No | Keep projection-off sanitizer and readiness checks proving fail-closed fallback. |
| FantasyPros projections | `research` | Blocked | No | June 5 metadata probe returned `200` with 597 rows; keep model/public use blocked until source rights, stored freshness, normal cadence/rate limits, mapping coverage, and attribution are approved. |
| FantasyPros `WW` rankings | `research` | Snapshot only | No | Recheck closer to season and require non-zero rows before waiver-priority use. |
| FantasyPros targets | `blocked` | Blocked | No | Keep target snapshots off until package access returns `200`. |
| FantasyPros articles | `blocked` | Blocked | No | Keep article snapshots off until package access and editorial-use terms are approved. |
| FantasyPros news | `research` | Snapshot only | No | Confirm production coverage, cadence, rate limits, and attribution terms. |
| SportsDataIO/RotoBaller news | `research` | Snapshot only | No | Validate package access, endpoint shape, rate limits, and Sleeper mapping. |
| SportsDataIO/FantasyData beyond news | `research` | Blocked | No | June 5 probe covered players, teams, schedule, injuries, depth charts, scoring, projections, usage/route docs, and news; protected endpoints remain `missing_config` until approved package credentials exist. |
| Fantasy Nerds API | `blocked` | Blocked | No | June 5 local shell has no Fantasy Nerds key configured; do not add or enable production key/features until current-season non-TEST rows are confirmed. |
| GridIron Data | `research` | Blocked | No | No key/package, endpoint, row, freshness, rate-limit, or mapping evidence exists; revisit only after key/package access exists. |
| Dynasty Daddy source selector | `research` | Blocked | No | June 5 audit captured public source-selector labels and player endpoint candidates; keep integration blocked until terms, cadence/rate limits, upstream attribution, player mapping, and privacy review pass. |
| Sleeper hidden account-level transactions | `blocked` | Blocked | No | June 5 audit found no official OAuth/app-authorization/partner path for pending, cancelled, failed, rejected, skipped, or losing account-level waiver/trade rows. Do not collect raw session/OAuth tokens; use public completed transactions, manual labels, or explicit sanitized exports until an approved path exists. |
| Official transaction source | `research` | Blocked | No | Current roster-room deltas infer non-trade movement from nflverse rosters/weekly rosters/depth charts/trades; add only after an approved source can classify signings, releases, waivers, reserve moves, and exact dates. |

Run the gate audit with:

```sh
pnpm run audit:source-readiness-gates
```

## Metadata-Only Audits

Use these commands before any model consumes new provider fields:

```sh
CHECK_FANTASYPROS_EXPANDED=true CHECK_FANTASYPROS_PROJECTIONS=true pnpm run check:fantasypros
pnpm run probe:football-data-sources
pnpm run audit:zero-row-valuation-sources
```

`probe:football-data-sources` does not print provider payloads or credentials. Without approved credentials, SportsDataIO/FantasyData endpoint probes report `missing_config` and do not call package endpoints.

Latest FantasyPros metadata evidence from June 5, 2026:

- `projections`: `200` with 597 rows; research-only until source rights, stored freshness metadata, normal cadence/rate limits, mapping coverage, and attribution are approved.
- weekly ECR Week 1: `200` with non-zero position rows; Weeks 2 and 3 returned `200` with zero rows and `last_updated` of `1/01`.
- `WW` Week 1: `200` with zero rows and `last_updated` of `1/01`; do not use for waiver priority.
- `targets` and `articles`: `403 Forbidden`; keep snapshots blocked.
- `players`, `news`, `injuries`, and `player-points`: reachable in metadata probes; production model use still requires the gate evidence above.

## Dated Follow-Ups

- Re-review the projection-source baseline in August 2026, when weekly projections, waiver rankings, targets, injuries, and depth-chart packages should be mature enough to re-evaluate.
- Recheck FantasyPros `WW` snapshots closer to the 2026 season and require non-zero rows before using them for waiver priority.
- Re-run SportsDataIO/FantasyData probes only after package access is approved; do not treat docs coverage as row coverage.
- Revisit Sleeper hidden account-level transaction capture only if Sleeper publishes an approved authorization/partner path or if users can provide an explicit sanitized export that avoids raw token capture and private payload storage.
