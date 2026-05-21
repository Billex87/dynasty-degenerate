# Projections / SOS Source Policy

Normal user loads must keep weekly projection, schedule, and SOS reads snapshot-backed. Sleeper remains the only live source during login/report load, and only for current league state such as rosters, matchups, submitted lineups, transactions, drafts, and players.

## Approved Blend For Current Schedule Features

| Signal | Current Source | Load Boundary | Notes |
| --- | --- | --- | --- |
| Full NFL schedule | NFL.com schedules page or an approved schedule export/API derived from the same official schedule fields | Cron/admin snapshot, then stored normalized schedule snapshot | NFL.com is the human-readable reference for season/week/team/kickoff data, but normal report loads must still read `nfl-schedule-games-v1` snapshots. |
| NFL bye weeks | NFL.com 2026 schedule-release map embedded in `server/schedulePlanning.ts` | Static app data | Used for player schedule profiles, roster gap checks, and bye-window notes. |
| League matchups and submitted lineups | Sleeper league matchup/current-state endpoints | Live on report load | Safe to call on login because this is the live league state the user expects to refresh. |
| Strength of schedule | DraftSharks SOS snapshot, preferably the percentage-based QB/RB/WR/TE/K/DEF rows | Cron/admin refresh, then stored snapshot | DraftSharks is the primary SOS signal. The public page documents that values are percent differences in fantasy points allowed vs. what opponents usually score. Use approved partner/API/export access, not live user-load scraping. |
| FantasyPros matchup calendar | Retired for SOS | No scheduled/admin refresh | Do not call FantasyPros matchup pages for SOS. The active parser, refresh job, diagnostics, and public readout paths are removed unless a future decision approves a separate non-SOS use. |
| Weekly projections | Not approved for public production yet | Blocked until endpoint rights/freshness are validated | FantasyPros projections are useful, but paid/public use still needs approved commercial terms and rate-limit validation. |
| Player props / market signal | OpticOdds stored props snapshot after key approval | Cron/admin refresh, then stored snapshot | Can support start/sit confidence once real snapshots exist and responsible-gaming boundaries are in place. |

## DraftSharks vs FantasyPros

DraftSharks is the preferred SOS source for schedule strength decisions because it is position/team based, supports QB/RB/WR/TE/K/DEF, and exposes week-level percentage deltas that map cleanly to a slider window. Positive percentages are easier matchups, negative percentages are harder matchups, and lower values should reduce pickup/start confidence.

FantasyPros matchup pages are retired from the active SOS pipeline. They must not refresh through scheduled/admin jobs and must not create, boost, cap, trace, or override public SOS actions. `server/scheduleSourceDecision.ts` uses DraftSharks weekly percentages for the final action and confidence.

## Implementation Status

- `server/reportStaticInputs.ts` loads DraftSharks/SOS through snapshot mode for report loads.
- `server/draftSharksSchedule.ts` normalizes DraftSharks season SOS, remaining SOS, streamer/avoid weeks, and week-level percentage matchups for slider-based reads.
- `server/scheduleSourceDecision.ts` uses DraftSharks percentage SOS for selected-week action and confidence, with no FantasyPros matchup-calendar fallback or passive trace path.
- `server/reportStaticSections.ts` caches player schedule profiles.
- `server/schedulePlanning.ts` builds schedule planning, streamer candidates, bye windows, and matchup previews from Sleeper current-state plus stored schedule profiles.
- `server/projectionFeatureFlags.ts` keeps projection rollout gated by one global flag, one source flag, one projection-type flag, and projection kill switches. Projection paths should fail closed unless all three enabling flags are explicit.
- `server/projectionFeatureFlags.ts` also exposes a readiness gate for bad projection snapshots, stale schedule snapshots, and broken source mappings so projection-influenced reads can fail closed without breaking the base report.
- `server/nflTeamCodes.ts` normalizes NFL team aliases across Sleeper, FantasyPros, DraftSharks, ESPN, SportsDataIO, and internal feeds before schedule joins.
- `server/nflScheduleSnapshots.ts` defines the normalized `nfl-schedule-games-v1` snapshot payload with season/week/game/team/start/status keys, source metadata, checksums, parser version, source-versioned storage keys, and coverage diagnostics that compare stored schedule weeks against Sleeper and provider projection weeks.
- `server/matchupScheduleSnapshots.ts` defines a provider-neutral `matchup-calendar-sos-v1` payload for DraftSharks/internal matchup rows with matchup rating/stars, opponent rank, home/away, source URL, fetched timestamp, checksum, parser version, and source version.
- `server/playerProjectionSnapshots.ts` defines the normalized `player-projection-snapshots-v1` payload with scoring profile, projection type, source version, core stat projections, freshness fields, identity diagnostics, and quarantine rows for ambiguous or unusable player matches.
- `server/playerProjectionContext.ts` joins normalized projection rows to normalized schedule games and optional dynasty/redraft value context. It also exposes source-backed slots for opponent defense, game environment, depth chart, and opportunity/runway context without enabling public projection reads.
- `server/projectionReadoutPolicy.ts` turns projection context into a guarded AI readout policy with evidence language, source trace text, confidence caps, fallback copy, and provider-attribution checks.
- `server/projectionAdminDiagnostics.ts` reports schedule/projection snapshot health and projection-snapshot diffs for admin review.
- `server/projectionAccuracyBacktest.ts` and `scripts/backtest-player-projections.ts` compare stored projection snapshots to final actuals by source, position, week, home/away, opponent strength, rookie status, and draft-capital bucket.
- `server/projectionRolloutFixtures.ts` provides normal-week, bye-heavy, injury-heavy, rookies-heavy, and playoff-week fixtures for regression and future UI coverage.
- `server/projectionPerformanceBudget.ts` gates projection joins against row-count, duration, per-row, fanout, cache, and static-section budgets.
- `server/projectionReleaseGates.ts` codifies the admin-only -> internal leagues -> limited production -> general availability rollout rules.
- `server/sourceSnapshotFreshness.ts` includes `draftsharks-sos-v1`, `player-props-opticodds-v1`, FantasyPros news, SportsDataIO/RotoBaller news, ESPN depth charts, redraft source snapshots, and Sleeper season-stat snapshots in report freshness diagnostics.
- `server/fantasyProsHealth.ts` emits endpoint-level health rows for FantasyPros API coverage without printing payloads or secrets.

## Projection Rollout Flags

Projection features require:

- `ENABLE_PROJECTION_FEATURES=true`
- one source flag such as `ENABLE_FANTASYPROS_PROJECTIONS=true`, `ENABLE_DRAFTSHARKS_PROJECTIONS=true`, `ENABLE_SPORTSDATAIO_PROJECTIONS=true`, `ENABLE_FANTASY_NERDS_PROJECTIONS=true`, or `ENABLE_INTERNAL_PROJECTION_ESTIMATES=true`
- one projection-type flag such as `ENABLE_WEEKLY_PROJECTIONS=true`, `ENABLE_REST_OF_SEASON_PROJECTIONS=true`, `ENABLE_PRESEASON_PROJECTIONS=true`, `ENABLE_PLAYOFF_WEEK_PROJECTIONS=true`, `ENABLE_POSITION_PROJECTIONS=true`, `ENABLE_TEAM_DEFENSE_PROJECTIONS=true`, `ENABLE_KICKER_PROJECTIONS=true`, or `ENABLE_INJURY_ADJUSTED_PROJECTIONS=true`

Any of these kill switches blocks projection paths even when the enabling flags are present:

- `DISABLE_PROJECTION_FEATURES=true`
- `DISABLE_PROJECTION_SNAPSHOTS=true`
- `DISABLE_PROJECTION_READOUTS=true`
- `DISABLE_PROJECTION_JOINS=true`

The FantasyPros endpoint snapshot refresh now requires the FantasyPros source flag plus at least one projection-type flag before it includes projection payloads.

Readouts must also pass projection readiness:

- projection snapshot status is `ready`
- normalized schedule snapshot status is `ready`
- source/player/team mapping status is `ready`

If any of those are missing, stale, errored, disabled, partial, unknown, or broken, the app should suppress projection-specific claims and continue with base schedule/value/roster reads.

## Normalized Schedule Snapshot Model

Full schedule snapshots use `providerDataSnapshots` with source key `nfl-schedule-games-v1` and snapshot key `{season}:{sourceVersion}`. A correction, flex update, postponement, or new provider release should use a new `sourceVersion` so old schedule reads remain auditable.

Each normalized game row stores:

- `season`
- `week`
- `gameId`
- `homeTeam`
- `awayTeam`
- `startsAt`
- `gameStatus`
- `sourceVersion`
- `source`
- `sourceUrl`
- `fetchedAt`
- `publishedAt`
- `seasonType`
- `venue`
- `neutralSite`
- `shortRest`
- `longRest`
- `travelDistanceBucket`
- `venueType`
- `weatherSensitivity`
- `internationalGame`
- `divisionGame`
- `conferenceGame`
- `projectedPlayoffWeekRelevance`

The payload also stores `rowCount`, `checksum`, and `parserVersion`.

Schedule coverage diagnostics compare:

- stored schedule weeks
- Sleeper matchup weeks
- provider projection weeks
- team coverage

If a week or team is missing, projection-specific claims should stay suppressed for that gap while bye-week planning, neutral SOS fallback, and internal value reads remain available.

## Matchup / SOS Snapshot Model

Matchup and short-window SOS snapshots use source key:

`matchup-calendar-sos-v1:{source}:{season}:{position}`

Each row is keyed by season, position, source, player or team-defense identity, week, opponent, and source version. Rows store matchup rating, stars, opponent rank, matchup tier, home/away, source URL, and fetched timestamp.

Freshness policy is phase-aware:

- in season: 24-hour cadence
- preseason: 72-hour cadence
- offseason: 168-hour cadence

Expired DraftSharks SOS snapshots should suppress matchup-driven reads. Stale but unexpired snapshots can remain admin-visible with capped confidence. FantasyPros matchup rows should not be loaded to rescue, trace, or compare against missing or stale DraftSharks SOS decisions.

## Normalized Player Projection Snapshot Model

Player projection snapshots use `providerDataSnapshots` with source key:

`player-projection-snapshots-v1:{source}:{scoringProfile}:{projectionType}`

Snapshot keys are:

`{season}:w{week}:{sourceVersion}` for weekly rows, or `{season}:all:{sourceVersion}` for all-season rows.

Each normalized projection row stores:

- `season`
- `week`
- `playerId`
- `sourcePlayerId`
- `playerName`
- `team`
- `position`
- `source`
- `scoringProfile`
- `projectionType`
- `sourceVersion`
- projected fantasy points
- passing, rushing, receiving, kicking, and defensive stat components when available
- confidence and expert-count metadata when available
- injury status, rookie flag, match confidence, provider-updated timestamp, and published timestamp

The snapshot stores `fetchedAt`, `publishedAt`, `validForWeek`, `providerUpdatedAt`, `rowCount`, `positionCoverage`, `missingStarterCount`, `sourceError`, `staleReason`, `checksum`, `parserVersion`, identity diagnostics, and quarantined rows. Quarantined rows cannot power readouts.

## Projection Context Join

Projection context rows link:

- projection source, scoring profile, type, version, player, team, and fantasy points
- schedule week, opponent, home/away, kickoff, game status, and schedule source version
- dynasty value, redraft value, weekly projection, and a value-context label
- optional opponent-defense context such as positional fantasy points allowed, pace, funnels, pressure, explosive plays, red-zone weakness, turnover opportunity, and sack opportunity
- optional game-environment context such as wind, precipitation, temperature, dome/outdoor, licensed Vegas totals, implied team totals, and postponement risk
- optional depth-chart context such as starter status, role stability, injury replacement role, backup pressure, snap-share trend, and recent snap share
- optional opportunity context such as draft round, rookie-pick tier, contract tier, team investment, rookie ramp, patience window, and opportunity score
- trace lines explaining the projection source, game join, context joins, and short-term-vs-dynasty boundary

If the schedule snapshot is missing, opponent claims are suppressed while the projection row remains available for admin diagnostics.

## Projection Display Language

Public readouts must name projection evidence according to what actually exists:

- Say `FantasyPros projection`, `DraftSharks projection`, `SportsDataIO projection`, or another provider name only when a fresh stored snapshot from that provider exists for the relevant player/team, week, scoring format, and projection type, and the source agreement allows user-facing attribution.
- Say `stored provider projection` when the app can verify freshness and scoring context but public attribution is not approved.
- Say `internal estimate` only for app-derived calculations from schedule, value, role, usage, or market context. Do not call these provider projections.
- Say `schedule/value context only` when projection flags are disabled, snapshots are stale, identity matching is uncertain, or the player/week/scoring row is missing.
- Do not show projection-driven start/sit, lineup-strength, trade, or valuation claims unless the readout can expose the source, week, scoring profile, fetched or published timestamp, freshness status, and the biggest signal that changed the read.

## Blocked Before Projection-Driven Features

- FantasyPros projection endpoint terms/rate limits must be approved for production use.
- FantasyPros matchup-calendar access should stay retired unless a future non-SOS use case is approved; it should not drive or decorate public SOS recommendations.
- A first real OpticOdds player-prop snapshot must be stored before prop thresholds are tuned.
- Projection source/version metadata needs to be captured with stored snapshots before lineup-strength or confidence models should treat projections as first-class inputs.
- Dynamic schedule and matchup values must update through scheduled/admin snapshots with version history and stale-row fallbacks, never through live provider calls during normal user-triggered report loads.
