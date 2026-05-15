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

## Coverage Matrix

| Source | Returns | Used Now | Could Power Later | Open Questions |
| --- | --- | --- | --- | --- |
| Sleeper | leagues, users, rosters, matchups, drafts, traded picks, transactions, players | league analysis, roster intelligence, draft/trade/waiver history, identity matching | matchup reads, schedule-week planner, exposure, alerts, lineup guidance | current-week projection context is not documented; draft/trade access is league-scoped |
| FantasyPros | rankings, projections, ADP, injuries, news, compare-players, player-points, player IDs | dynasty/redraft/devy blends, health diagnostics, news/status context | lineup strength, VORP/value-over-cost, trade explainers, news-to-value movement | production/commercial rights and rate limits must be approved before primary paid use |
| DraftSharks | rankings, SOS, bye weeks, D/ST, matchup/planning tools | approved-access SOS shell only | bye-week navigation, streamers, schedule-aware matchup reads | actual partner REST URL/payload still needs DraftSharks control-panel configuration |
| KeepTradeCut | community values, rankings, calculator, trade database | limited research/local historical context | trade comps and market trend views only with approved access | FAQ says no API/export and forbids scraping full values/data |
| Flock Fantasy | player rankings and exposure-style source rows where available | dynasty/rookie source research and blend support | portfolio exposure and roster concentration | feed stability and usage rights |
| FantasyCalc | dynasty/redraft values and source metadata | blended market values and confidence support | trend comparison, market deltas | refresh cadence and allowed production usage |
| Dynasty Nerds | dynasty, rookie, format-specific rankings | dynasty/rookie blending | format-specific rookie draft reads | coverage and freshness by format |
| Fantasy Nerds | API rankings/projections/ADP depending package | redraft/dynasty source checks when key is present | redraft projections and validation | live package must be confirmed current with production key |
| DynastyProcess / nflverse IDs | public dynasty values, ID maps, names, platform IDs | dynasty fallback/stabilizer, identity mapping | alias normalization, cross-platform ID joins | terms and freshness per dataset |
| Prospect Archive / NFL Draft Buzz | prospect rankings, notes, draft class, college, image/logo fields | devy and rookie prospect handling | scouting cards and prospect comparison | freshness and image/logo consistency |
| ESPN prospect metadata | player/team/college/external IDs | cross-source identity matching | better prospect/player normalization | which IDs are reliable as canonical |
| Internal snapshots/jobs | historical values, source health, report cache, confidence snapshots | trend analysis, diagnostics, backfills, calibration | anomaly detection, model backtests, source-history dashboards | retention and transfer budget tuning |

## External Findings

- FantasyPros API access is documented as personal/non-commercial and says not to build a competing product or service with API data: https://support.fantasypros.com/hc/en-us/articles/49749297704475-How-do-I-request-access-to-the-FantasyPros-API
- FantasyPros API docs expose useful NFL endpoints for news, players, player-points, targets, compare-players, consensus rankings, and projections: https://api.fantasypros.com/v2/docs
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
- Rookie/devy prospect comparison: reuse Prospect Archive, NFL Draft Buzz, FantasyPros Devy, Flock, and KTC Devy context.
- Cross-league exposure: persist league snapshots server-side, then aggregate player shares across synced leagues.
- Waiver/trade calibration: store outcome labels server-side and backtest bid/trade resistance confidence.
- Player source trace: show which feeds currently move each player's value and confidence.

## Compact Field Maps

These field maps are intentionally metadata-only. Do not paste full payloads, API keys, OAuth tokens, user cookies, hidden Sleeper tokens, or raw provider responses into this file.

| Source | Endpoint / Storage | Auth Model | Refresh / Load Boundary | Compact Field Map | IDs | Freshness | Known Gaps |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Sleeper league API | Sleeper league/user/roster/draft/transaction/matchup/player endpoints | Public league/user endpoints; hidden import uses a user-provided token once and does not store it | User load only; this is the only source expected on login/report load | `league_id`, `season`, `settings`, `scoring_settings`, `rosters`, `users`, `players`, `drafts`, `traded_picks`, `transactions`, `matchups` | Sleeper league/user/player/roster/transaction/draft IDs | season/week/status timestamps from Sleeper | Projection and prop context is incomplete, so use snapshots for those signals |
| Blended value snapshot | `ktcSnapshots` latest row | Stored internal snapshot | Nightly job; report load reads stored row | `player_id`, `player_name`, `position`, `team`, `value`, `rank`, `source_coverage`, `updated_at` | Sleeper player ID plus source IDs where available | `snapshotDate`, `createdAt` | Market data can lag news/role changes |
| Redraft source snapshot | `redraftSourceSnapshots` by season | Stored internal snapshot assembled by cron | Nightly job; report load reads stored row | `player_id`, `name`, `position`, `team`, `rank`, `projection`, `adp`, `source`, `scoring_format` | Sleeper, FantasyPros, ESPN, Yahoo where present | `snapshotKey`, `updatedAt`, source timestamps when present | Sub-source package access and freshness vary |
| FantasyPros rankings/projections | FantasyPros rankings, projections, ADP, compare-player, player-points endpoints | API key; production/commercial use needs approved rights | Cron/admin only; provider telemetry tracks calls | `player_id`, `player_name`, `position`, `team`, `rank`, `tier`, `adp`, `projected_points`, `injury_status`, `news` | FantasyPros ID plus name/team/position joins | source updated/published timestamps, stored snapshot key | Terms/rate limits must stay explicit before primary paid use |
| FantasyPros news snapshot | `providerDataSnapshots` `fantasypros-news-v1` | API key when configured | Nightly job; report load reads stored row | `player_name`, `player_id`, `team`, `position`, `headline`, `summary`, `published_at`, `source_url` | FantasyPros ID plus name/team/position joins | `published_at`, `snapshotKey`, `updatedAt` | Player joins depend on identity normalization |
| Devy and rookie snapshot | `devySourceSnapshots` by profile | Stored internal snapshot assembled by cron | Weekly/manual refresh; report load reads stored row | `player_name`, `college`, `position`, `class_year`, `rank`, `source`, `score`, `draft_year` | normalized player key, source ID when present | `snapshotKey`, `updatedAt` | College/prospect names need heavier normalization |
| ESPN depth charts | `providerDataSnapshots` `espn-depth-charts-v1` | Public metadata fetch through scheduled job | Nightly in season; no report-load ESPN fetch | `team`, `position`, `depth_order`, `player_name`, `espn_id`, `status` | ESPN ID, team abbreviation, name/team join key | `snapshotKey`, `updatedAt` | Depth order semantics vary by team/source page |
| DraftSharks SOS | `providerDataSnapshots` `draftsharks-sos-v1` | Partner/control-panel key and URL | Feature-flagged weekly job; no public-page scrape | `team`, `position`, `season_sos`, `tier`, `streamer_weeks`, `avoid_weeks`, `updated_at` | NFL team abbreviation, position | `updated_at`, `snapshotKey`, `updatedAt` | Needs final partner URL/payload/terms |
| OpticOdds props | `providerDataSnapshots` `player-props-opticodds-v1` | OpticOdds API key | Feature-flagged cron only after approval | `player_name`, `team`, `opponent`, `market`, `line`, `over_price`, `under_price`, `sportsbook`, `starts_at` | provider event/player key plus name/team join | `starts_at`, `last_updated`, `snapshotKey`, `updatedAt` | Needs real key, sportsbook tuning, and compliance boundaries |
| Sleeper season stats | `providerDataSnapshots` `sleeper-season-stats-v1:{season}` | Sleeper public stats through cron | Seasonal/long-term refresh | `player_id`, `season`, `week`, `team`, `position`, `stats` | Sleeper player ID | season/week/snapshot metadata | Backfill depth and stat normalization need tuning |
| NFL Draft Buzz prospects | `prospectSnapshots` `NFL Draft Buzz` | Stored prospect snapshot | Monthly/draft-cycle refresh | `player_name`, `position`, `school`, `class_year`, `height`, `weight`, `rank`, `scouting_summary`, `image_url` | normalized prospect key, college/name join | `snapshotMonth`, `createdAt` | Image/logo consistency and monthly freshness |
| FantasyCalc | Imported into value snapshots | Approved/public feed path only | Nightly source job; report load reads stored values | `player_name`, `position`, `team`, `value`, `rank`, `format`, `source_metadata` | source player ID where present, name/team/position join | source timestamp and snapshot date | Refresh cadence/source coverage should keep being audited |
| Flock Fantasy | Imported source rows where available | Approved/public feed path only | Nightly source job when available | `player_name`, `position`, `team`, `rank`, `exposure`, `format` | source key when present, name/team/position join | source timestamp and snapshot date | Feed stability and rights need approval |
| Dynasty Nerds | Imported dynasty/rookie ranking rows | Approved source path only | Nightly source job when available | `player_name`, `position`, `team`, `rank`, `format`, `rookie_flag` | source key when present, name/team/position join | source timestamp and snapshot date | Freshness by format should stay visible |
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
