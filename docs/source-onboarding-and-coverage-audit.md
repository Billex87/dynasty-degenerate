# Source Onboarding And Coverage Audit

This is the working source audit from the overnight todo pass. It keeps live integrations, blocked sources, future feature ideas, and licensing notes in one place.

## New-Source Probation Rule

Every new API, feed, scrape, or uploaded dataset starts at low effective weight until it proves:

- stable fetch health across multiple snapshots
- non-empty row counts for the target board
- acceptable source-consensus drift
- clear timestamp/freshness metadata
- source-specific feature flags and diagnostics
- approved production usage rights

Probation exits only after source-health rows and source-trust diagnostics show enough stable history to justify raising weight.

The projection/SOS source gate register lives in `docs/projection-source-readiness-gates.md`. Every new provider starts as `blocked` or `research`; only cron/admin/manual snapshot paths can move to `approved-for-snapshot`, and public provider-attributed claims require `approved-for-public-claim`.

Useful metadata-only commands:

```sh
pnpm run audit:source-readiness-gates
pnpm run probe:football-data-sources
pnpm run audit:zero-row-valuation-sources
```

`probe:football-data-sources` covers SportsDataIO/FantasyData players, teams, schedule, injuries, depth charts, scoring, projections, route/usage candidates, and news package access without printing payloads or credentials. If package credentials are absent, protected endpoints report `missing_config` and are not called.

## Coverage Matrix

| Source | Returns | Used Now | Could Power Later | Open Questions |
| --- | --- | --- | --- | --- |
| Sleeper | leagues, users, rosters, matchups, drafts, traded picks, transactions, players | league analysis, roster intelligence, draft/trade/waiver history, identity matching | matchup reads, schedule-week planner, exposure, alerts, lineup guidance | current-week projection context is not documented; draft/trade access is league-scoped |
| FantasyPros | rankings, projections, ADP, injuries, news, compare-players, player-points, player IDs | dynasty/redraft/devy blends, health diagnostics, news/status context | lineup strength, VORP/value-over-cost, trade explainers, and news-to-value movement after rights/freshness validation | Dynasty board is full PPR only at `https://www.fantasypros.com/nfl/rankings/dynasty-overall.php`; devy board is `https://www.fantasypros.com/nfl/rankings/devy-overall.php`; production/commercial rights, endpoint stability, attribution, and rate limits must be approved before primary paid/public use |
| DraftSharks | rankings, SOS, bye weeks, D/ST, matchup/planning tools | approved-access SOS shell only | bye-week navigation, streamers, schedule-aware matchup reads | actual partner REST URL/payload still needs DraftSharks control-panel configuration |
| KeepTradeCut | community values, rankings, calculator, trade database | limited research/local historical context | trade comps and market trend views only with approved access | FAQ says no API/export and forbids scraping full values/data |
| Flock Fantasy | dynasty Superflex and 1QB rankings, Best Ball redraft rankings, and exposure-style source rows where available | dynasty source research and blend support; redraft Best Ball signal | portfolio exposure and roster concentration | Devy board is not available; dynasty Superflex is `https://flockfantasy.com/rankings?format=superflex`; redraft Best Ball is `https://flockfantasy.com/rankings?format=BEST_BALL`; redraft Superflex Best Ball is `https://flockfantasy.com/rankings?format=best_ball_sf`; feed stability and usage rights still need approval |
| FantasyCalc | dynasty/redraft values and source metadata | blended market values and confidence support | trend comparison, market deltas | refresh cadence and allowed production usage |
| Dynasty Nerds | dynasty, rookie, format-specific rankings | dynasty/rookie blending | format-specific rookie draft reads | PPR, 1QB, SF, and SF TEP boards are available; SF TEP reference URL is `https://www.dynastynerds.com/dynasty-rankings/sf-tep/`; freshness by format should stay visible |
| Fantasy Nerds | API rankings/projections/ADP depending package | redraft/dynasty source checks when key is present | redraft projections and validation | live package must be confirmed current with production key |
| DynastyProcess / nflverse IDs | public dynasty values, ID maps, names, platform IDs | dynasty fallback/stabilizer, identity mapping | alias normalization, cross-platform ID joins | terms and freshness per dataset |
| Prospect Archive / NFL Draft Buzz | prospect rankings, notes, draft class, college, image/logo fields | devy and rookie prospect handling | scouting cards and prospect comparison | freshness and image/logo consistency |
| ESPN prospect metadata | player/team/college/external IDs | cross-source identity matching | better prospect/player normalization | which IDs are reliable as canonical |
| Internal snapshots/jobs | historical values, source health, report cache, confidence snapshots | trend analysis, diagnostics, backfills, calibration | anomaly detection, model backtests, source-history dashboards | retention and transfer budget tuning |

## External Findings

- FantasyPros API access is documented as personal/non-commercial and says not to build a competing product or service with API data: https://support.fantasypros.com/hc/en-us/articles/49749297704475-How-do-I-request-access-to-the-FantasyPros-API
- FantasyPros API docs expose useful NFL endpoints for news, players, player-points, targets, compare-players, consensus rankings, and projections: https://api.fantasypros.com/v2/docs
- FantasyPros public matchup calendar exposes player rank plus week-by-week sortable matchup ratings for positions including QB, RB, WR, TE, K, and DST; it is implemented only as a cron/admin snapshot source, not a live report-load scrape or a public SOS decision input: https://www.fantasypros.com/nfl/matchups/dst.php
- Detailed FantasyPros endpoint-to-feature mapping is tracked in `docs/fantasypros-endpoint-feature-audit.md`; the highest-value underused endpoints are targets, weekly ECR, waiver-wire rankings, player-points, projections, and compare-players.
- Sleeper official docs expose league users, matchups, traded picks, draft picks, and draft traded-picks endpoints; that is enough for league-scoped history but not a global trade/draft dataset: https://docs.sleeper.com/
- DraftSharks affiliate materials say partners can implement tools by iFrame or REST API documentation from the DraftSharks control panel, so integration should stay partner/API-key gated and should not scrape public pages: https://www.draftsharks.com/fantasy-football-affiliate-program
- nflreadr / ffverse player IDs include cross-platform IDs plus `name`, `merge_name`, birthdate, draft metadata, and `twitter_username`, which is useful for identity enrichment but not a nickname database: https://nflreadr.nflverse.com/reference/load_ff_playerids.html
- KeepTradeCut FAQ says there is no API or CSV export and that scraping player values/data is forbidden: https://keeptradecut.com/frequently-asked-questions
- Fantrax search results point to unofficial Python bindings rather than official stable docs, so it stays out of the blend until an approved integration path exists: https://fantraxapi.metamanager.wiki/en/stable/

## Nickname / Alias Research

The useful identity-enrichment fields from the `api to get nfl player nicknames` research are:

- `merge_name` and alternate name mappings from nflverse/nflreadr
- cross-platform IDs: Sleeper, FantasyPros, ESPN, Yahoo, Fleaflicker, CBS, MFL, PFR, Sportradar, FantasyData/SportsDataIO
- `twitter_username` where present
- suffix/short-name normalization from existing player-name maps

Do not prioritize storing informal nicknames yet. The better immediate value is a normalized alias table keyed by Sleeper ID plus cross-source IDs and merge names.

## Feature Ideas Already Supported By Current Data

- News-to-value movement: join FantasyPros/Sleeper news timestamps to KTC/FantasyCalc/FantasyPros snapshot movement.
- ADP vs value-over-cost: compare FantasyPros ADP/DYNADP/RKADP to blended dynasty/redraft values.
- Rookie/devy prospect comparison: reuse Prospect Archive, NFL Draft Buzz, FantasyPros Devy, and KTC Devy context. Do not include Flock in devy because Flock does not publish a devy board.
- Cross-league exposure: persist league snapshots server-side, then aggregate player shares across synced leagues.
- Waiver/trade calibration: store outcome labels server-side and backtest bid/trade resistance confidence.
- Player source trace: show which feeds currently move each player's value and confidence.
- FantasyPros endpoint expansion: use targets for waiver role growth, weekly ECR and waiver-wire rankings for start/sit and pickups, player-points for consistency/backtests, compare-players for close-call explainers, and projections only after snapshot freshness and rate-limit diagnostics are stable.

## Compact Field Maps

These field maps are intentionally metadata-only. Do not paste full payloads, API keys, OAuth tokens, user cookies, hidden Sleeper tokens, or raw provider responses into this file.

| Source | Endpoint / Storage | Auth Model | Refresh / Load Boundary | Compact Field Map | IDs | Freshness | Known Gaps |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Sleeper league API | Sleeper league/user/roster/draft/transaction/matchup/player endpoints | Public league/user endpoints; hidden import uses a user-provided token once and does not store it | User load only; this is the only source expected on login/report load | `league_id`, `season`, `settings`, `scoring_settings`, `rosters`, `users`, `players`, `drafts`, `traded_picks`, `transactions`, `matchups` | Sleeper league/user/player/roster/transaction/draft IDs | season/week/status timestamps from Sleeper | Projection and prop context is incomplete, so use snapshots for those signals |
| Blended value snapshot | `ktcSnapshots` latest row | Stored internal snapshot | Nightly job; report load reads stored row | `player_id`, `player_name`, `position`, `team`, `value`, `rank`, `source_coverage`, `updated_at` | Sleeper player ID plus source IDs where available | `snapshotDate`, `createdAt` | Market data can lag news/role changes |
| Redraft source snapshot | `redraftSourceSnapshots` by season | Stored internal snapshot assembled by cron | Nightly job; report load reads stored row | `player_id`, `name`, `position`, `team`, `rank`, `projection`, `adp`, `source`, `scoring_format` | Sleeper, FantasyPros, ESPN, Yahoo where present | `snapshotKey`, `updatedAt`, source timestamps when present | Sub-source package access and freshness vary |
| FantasyPros rankings/projections | FantasyPros rankings, projections, ADP, compare-player, player-points endpoints | API key; production/commercial use needs approved rights | Cron/admin only; provider telemetry tracks calls | `player_id`, `player_name`, `position`, `team`, `rank`, `tier`, `adp`, `projected_points`, `injury_status`, `news` | FantasyPros ID plus name/team/position joins | source updated/published timestamps, stored snapshot key | Terms/rate limits must stay explicit before primary paid use |
| FantasyPros news snapshot | `providerDataSnapshots` `fantasypros-news-v1` | API key when configured | Nightly job; report load reads stored row | `player_name`, `player_id`, `team`, `position`, `headline`, `summary`, `published_at`, `source_url` | FantasyPros ID plus name/team/position joins | `published_at`, `snapshotKey`, `updatedAt` | Player joins depend on identity normalization |
| SportsDataIO/RotoBaller news snapshot | `providerDataSnapshots` `sportsdataio-news-v1` | SportsDataIO API key and news-feed entitlement | Nightly job when `ENABLE_SPORTSDATAIO_NEWS=true`; report load reads stored row | `player_name`, `player_id`, `team`, `headline`, `summary`, `published_at`, `source_url` | SportsDataIO player ID where returned plus name/team joins | `published_at`, `snapshotKey`, `updatedAt` | Package access and Sleeper ID mapping need production validation |
| SportsDataIO/FantasyData endpoint probes | metadata-only probe targets for players, teams, schedules, injuries, depth charts, scoring, projections, route/usage candidates, and news | SportsDataIO/FantasyData package key when approved | Research/probe only; no report-load calls and no model use until approved | row count, response shape, coverage-term hits, status code, duration | SportsDataIO/FantasyData player/team IDs when returned | provider response metadata only | Endpoint/package access, rate limits, player mapping, and terms are unapproved for model input |
| nflverse/ffverse draft-capital snapshot | `providerDataSnapshots` `nflverse-draft-capital-v1` | Public nflreadr/DynastyProcess player ID dataset | Nightly dynamic-data refresh; report load reads stored row | `sleeper_id`, `gsis_id`, `fantasypros_id`, `espn_id`, `name`, `position`, `team`, `draft_year`, `draft_round`, `draft_ovr`, `college` | Sleeper, GSIS, FantasyPros, ESPN, MFL, Yahoo, Fleaflicker, PFR IDs | `snapshotKey`, `generatedAt`, `db_season` | Upstream dataset freshness and missing non-fantasy positions need monitoring |
| nflverse usage/snap snapshot | `providerDataSnapshots` `nflverse-usage-v1:{season}` | Public nflverse `stats_player` and `snap_counts` datasets | Dynamic-data refresh for the latest available stats season at or before the last completed season; report load reads stored row | `gsis_id`, `player_name`, `position`, `team`, `season`, `games`, `targets`, `carries`, `receptions`, `fantasy_points_ppr`, `avg_target_share`, `air_yards_share`, `wopr`, `avg_offense_snap_pct`, `target_trend`, `carry_trend` | GSIS ID plus player name/team/position joins | `snapshotKey`, `generatedAt`, season/week coverage | Route participation is not included; aggregate `stats_player` rows do not fake weekly trend windows |
| nflverse team-environment snapshot | `providerDataSnapshots` `nflverse-team-environment-v1:{season}` | Public nflverse `stats_team` and `pbp` releases | Dynamic-data refresh for the latest available stats season at or before the last completed season; report load reads stored row | `team`, `season`, `games`, `pass_attempts`, `carries`, `targets`, `dropbacks`, `designed_play_volume`, `pass_rate`, `rush_rate`, `plays_per_game`, `targets_per_game`, `passing_epa`, `rushing_epa`, `pass_rate_rank`, `rush_rate_rank`, `neutral_script_pass_rate`, `red_zone_pass_rate`, `red_zone_rush_rate`, `non_garbage_pass_rate`, `estimated_seconds_per_play`, `pace_rank`, `no_huddle_rate`, `tendency` | NFL team abbreviation and season | `snapshotKey`, `generatedAt`, season coverage | Pace is estimated from play-clock movement; coach/play-caller attribution still needs a coaching snapshot |
| nflverse roster-room snapshot | `providerDataSnapshots` `nflverse-roster-room-v1:{currentRosterSeason}` | Public nflverse rosters, weekly rosters, depth chart, trades, and prior-season player stats releases | Dynamic-data refresh comparing current roster season against previous season; report load reads stored row | `team`, `position`, `season`, `previous_season`, `current_count`, `previous_count`, `net_change`, `additions`, `losses`, `rookie_additions`, `premium_additions`, `movement_type`, `movement_confidence`, `movement_quality_tier`, `movement_impact_score`, `prior_season_targets`, `prior_season_carries`, `prior_season_fantasy_points`, `first_seen_week`, `last_seen_week`, `status_timing`, `trade_date`, `trade_teams`, `depth_chart_top`, `vacated_targets`, `added_prior_targets`, `net_opportunity_score`, `incumbent_promotion_score`, `top_returning_depth_player`, `competition_level`, `vacated_opportunity_signal` | GSIS ID, Sleeper ID, PFR ID, player name, team abbreviation, position | `snapshotKey`, `generatedAt`, current/previous season coverage | Trades are typed from the nflverse trades release; non-trade movement is inferred from draft metadata and weekly roster timing until a broader official transaction feed is approved |
| nflverse player/team situation snapshots | proposed expanded `providerDataSnapshots` `nflverse-player-situation-v1:{season}` | Public nflverse weekly rosters, trades, participation, and play-by-play joins | Cron/admin only; report load should read stored rows | vacated targets/carries, route participation, depth-chart changes over time, injury returns, camp/practice-squad churn | GSIS player ID, team abbreviation, season, week/game IDs | release asset season plus `generatedAt` | Current first pass now has `stats_player`, `stats_team`, `pbp`, rosters, weekly rosters, trades, and depth charts; full situation deltas still need participation/route data and broader official transaction classification |
| nflverse public advanced snapshots | proposed `providerDataSnapshots` `nflverse-public-advanced-v1:{season}` | Public nflverse `nextgen_stats`, `pfr_advstats`, `ftn_charting`, and `pbp_participation` releases | Cron/admin only; report load should read stored rows | NGS separation/cushion/YAC over expected/rushing efficiency; PFR ADOT/drops/YAC/broken tackles/pressure; FTN motion/play-action/RPO/screens/catchable/drop flags; participation personnel and primary receiver route | GSIS player ID, PFR player ID, team, play/game IDs | source release season and generated timestamp | Public participation route is primary receiver only; do not label it exact route share or YPRR |
| Coach and scheme snapshot | proposed `providerDataSnapshots` `nfl-coaching-staff-v1:{season}` | Curated official team staff pages, team announcements, NFL.com, and Pro Football Reference team pages | Manual/cron source review; report load should read stored rows | `team`, `season`, `headCoach`, `offensiveCoordinator`, `playCaller`, `firstSeasonWithTeam`, `priorTeam`, `priorRole`, `sourceUrl`, `verifiedAt`, `status` | team abbreviation and season | `verifiedAt`, source URL date when available | Coaching staffs are volatile; reduce confidence when a row is reported or inferred instead of official |
| Licensed route/YPRR source | proposed only after approval | Fantasy Points Data Suite, PFF, SportsDataIO/FantasyData, FTN Data, or another licensed route-volume source | Blocked until terms, endpoint shape, and package access are confirmed | `routes_run`, `route_share`, `targets_per_route_run`, `yards_per_route_run`, first-read/route-family fields if licensed | provider player IDs mapped to GSIS/Sleeper/name/team | provider timestamp and license/package metadata | Do not expose exact route metrics from estimated public data |
| nflverse injury-history snapshot | `providerDataSnapshots` `nflverse-injuries-v1:{season}` | Public nflverse injuries dataset | Dynamic-data refresh for the last completed season; report load reads stored row | `gsis_id`, `player_name`, `position`, `team`, `season`, `reports`, `out_count`, `questionable_count`, `limited_count`, `primary_injuries`, `note` | GSIS ID plus name/team/position joins | `snapshotKey`, `generatedAt`, report weeks | Practice-report wording is not a medical severity model |
| nflverse combine snapshot | `providerDataSnapshots` `nflverse-combine-v1` | Public nflverse combine dataset | Dynamic-data refresh; report load reads stored row | `pfr_id`, `player_name`, `position`, `school`, `height`, `weight`, `forty`, `vertical`, `broad_jump`, `bench`, `speed_score`, `draft_round`, `draft_overall` | PFR ID plus name/position joins | `snapshotKey`, `generatedAt`, draft/combine season | Historical coverage is uneven for older or missing combine invitees |
| nflverse contracts snapshot | `providerDataSnapshots` `nflverse-contracts-v1` | Public nflverse historical contracts dataset | Dynamic-data refresh; report load reads stored row | `player_name`, `position`, `team`, `active`, `year_signed`, `years`, `value`, `apy`, `guaranteed`, `draft_year`, `draft_round`, `draft_overall`, `investment_tier` | normalized player name plus team/position joins | `snapshotKey`, `generatedAt`, contract year | Name-only matching can miss team changes and duplicate names |
| Devy and rookie snapshot | `devySourceSnapshots` by profile | Stored internal snapshot assembled by cron | Weekly/manual refresh; report load reads stored row | `player_name`, `college`, `position`, `class_year`, `rank`, `source`, `score`, `draft_year` | normalized player key, source ID when present | `snapshotKey`, `updatedAt` | College/prospect names need heavier normalization |
| ESPN depth charts | `providerDataSnapshots` `espn-depth-charts-v1` | Public metadata fetch through scheduled job | Nightly in season; no report-load ESPN fetch | `team`, `position`, `depth_order`, `player_name`, `espn_id`, `status` | ESPN ID, team abbreviation, name/team join key | `snapshotKey`, `updatedAt` | Depth order semantics vary by team/source page |
| DraftSharks SOS | `providerDataSnapshots` `draftsharks-sos-v1` | Partner/control-panel key and URL | Feature-flagged weekly job; no public-page scrape | `team`, `position`, `season_sos`, `tier`, `streamer_weeks`, `avoid_weeks`, `updated_at` | NFL team abbreviation, position | `updated_at`, `snapshotKey`, `updatedAt` | Needs final partner URL/payload/terms |
| OpticOdds props | `providerDataSnapshots` `player-props-opticodds-v1` | OpticOdds API key | Feature-flagged cron only after approval | `player_name`, `team`, `opponent`, `market`, `line`, `over_price`, `under_price`, `sportsbook`, `starts_at` | provider event/player key plus name/team join | `starts_at`, `last_updated`, `snapshotKey`, `updatedAt` | Needs real key, sportsbook tuning, and compliance boundaries |
| Sleeper season stats | `providerDataSnapshots` `sleeper-season-stats-v1:{season}` | Sleeper public stats through cron | Seasonal/long-term refresh | `player_id`, `season`, `week`, `team`, `position`, `stats` | Sleeper player ID | season/week/snapshot metadata | Backfill depth and stat normalization need tuning |
| NFL Draft Buzz prospects | `prospectSnapshots` `NFL Draft Buzz` | Stored prospect snapshot | Monthly/draft-cycle refresh | `player_name`, `position`, `school`, `class_year`, `height`, `weight`, `rank`, `scouting_summary`, `image_url` | normalized prospect key, college/name join | `snapshotMonth`, `createdAt` | Image/logo consistency and monthly freshness |
| FantasyCalc | Imported into value snapshots | Approved/public feed path only | Nightly source job; report load reads stored values | `player_name`, `position`, `team`, `value`, `rank`, `format`, `source_metadata` | source player ID where present, name/team/position join | source timestamp and snapshot date | Refresh cadence/source coverage should keep being audited |
| Flock Fantasy | Imported dynasty SF/1QB and redraft Best Ball source rows where available | Approved/public feed path only | Nightly source job when available | `player_name`, `position`, `team`, `rank`, `exposure`, `format` | source key when present, name/team/position join | source timestamp and snapshot date | No devy board; feed stability and rights need approval |
| Dynasty Nerds | Imported dynasty/rookie ranking rows | Approved source path only | Nightly source job when available | `player_name`, `position`, `team`, `rank`, `format`, `rookie_flag` | source key when present, name/team/position join | source timestamp and snapshot date | PPR, 1QB, SF, and SF TEP coverage should stay visible by format |
| Fantasy Nerds | Rankings/projections/ADP endpoints if key/package allows | API key/package dependent | Cron/admin only if approved | `player_name`, `position`, `team`, `rank`, `projection`, `adp`, `package` | Fantasy Nerds ID when returned, name/team/position join | source timestamp and snapshot date | Current endpoints/package access need production key confirmation |
| DynastyProcess / nflverse | Public dynasty values and player ID maps | Public dataset terms | Nightly/weekly enrichment | `player_name`, `merge_name`, `position`, `team`, `platform_ids`, `value`, `age`, `draft_metadata` | Sleeper, ESPN, Yahoo, FantasyPros, GSIS, PFR IDs | dataset version and snapshot date | Dataset versioning/freshness should stay explicit |
| Yahoo / Fantrax / FFPC | Official/approved docs and probe-only checks | Yahoo OAuth/app approval; Fantrax/FFPC partner approval | Research only until approved | league/team/player IDs, matchups, rosters, projected points, ADP/ownership if licensed | platform player IDs where licensed | season/week/projection timestamps if returned | Do not scrape or authenticate with user cookies |

## Admin Coverage Matrix

The admin-only source coverage matrix is served by `system.sourceCoverageMatrix` and rendered under Admin Diagnostics. It combines the compact field maps above with stored snapshot metadata and source-health rows:

- no live provider fetches are made by the matrix
- no full payloads are returned to the browser
- normal owner report loads still depend on Sleeper plus stored snapshots
- blocked/research sources stay visible as approval work, not production dependencies

## DraftSharks Approved-Access Shell

- `ENABLE_DRAFTSHARKS_SOS=true` is required before any DraftSharks SOS call runs.
- `DRAFTSHARKS_API_KEY` and `DRAFTSHARKS_SOS_URL` must come from approved DraftSharks partner/control-panel access.
- The app does not scrape DraftSharks public pages.
- The normalizer accepts flexible team/position SOS rows with season SOS score, tier, streamer weeks, avoid weeks, and updated timestamp fields.
- When loaded, DraftSharks enriches `PlayerScheduleProfile.seasonSOS`, `scheduleTier`, `streamerWeeks`, and `avoidWeeks`; otherwise schedule planning continues using NFL.com bye weeks plus Sleeper league data.
