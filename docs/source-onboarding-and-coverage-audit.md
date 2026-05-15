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
| DraftSharks | rankings, SOS, bye weeks, D/ST, matchup/planning tools | source research only | bye-week navigation, streamers, schedule-aware matchup reads | public docs emphasize site sync; partner REST/API access still needs account/partner confirmation |
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

