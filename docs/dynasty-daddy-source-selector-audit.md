# Dynasty Daddy Source Selector Audit

Audit date: June 5, 2026

Target page:

- `https://dynasty-daddy.com/fantasy-rankings/lamarjacksonqb?league=1312139584427012096&year=2026&platform=0&userId=472986961783549952&teamId=3`

Supporting public pages:

- `https://dynasty-daddy.com/fantasy-rankings`
- `https://dynasty-daddy.com/privacy`
- `https://www.patreon.com/DynastyDaddy`

## Gate Decision

Status: `research`

Do not integrate Dynasty Daddy source-selector rows into Dynasty Degens valuation, projection, start/sit, waiver, trade, or draft models. The public app exposes useful source-selector metadata and player history fields, but production use still needs terms approval, cadence/rate-limit evidence, stable endpoint contracts, player-ID mapping, and approved attribution language.

League/user/team query params on the target URL are treated as research context only. Do not persist or replay another user's Dynasty Daddy league-scoped payloads.

## Probe Evidence

The public page returned a JavaScript-rendered SPA shell. The current HTML referenced `chunk-SAMHMN56.js`, which contains the source-selector enum, display labels, and API endpoint assignment block.

Observed public endpoint assignments in the bundle:

| Purpose | Endpoint |
| --- | --- |
| Current all-player values | `/api/v1/player/all/today` |
| Market-specific current values | `/api/v1/player/all/market/{market}` |
| Previous all-player values | `/api/v1/player/all/prev/{...}` |
| Historical player values | `/api/v1/player/{playerNameId}` |
| Player details | `/api/v1/player/details/{playerNameId}` |
| Player trade details | `/api/v1/player/details/trade/{playerNameId}` |
| Rostership history | `/api/v1/player/rostership/historical/{...}` |
| Player points | `/api/v1/player/points` |
| Player game logs | `/api/v1/player/gamelogs/{...}` |
| Weekly projections | `/api/v1/player/projections/week` |
| Player projection details | `/api/v1/player/projections/details` |
| Projection accuracy | `/api/v1/player/projections/accuracy` |
| Draft ADP search | `/api/v1/draft/adp` |
| Draft ADP details | `/api/v1/draft/adp/details` |
| Trade database search | `/api/v1/trade/search` |
| Trade volume | `/api/v1/trade/volume` |

Public metadata-only probes for `lamarjacksonqb` returned:

| Endpoint | HTTP | Shape | Row Count / Size | Notes |
| --- | --- | --- | --- | --- |
| `/api/v1/player/details/lamarjacksonqb?year=2026` | `200` | object with `profile`, `tradeData`, `rostership` | `profile` 1 row, `tradeVolume` 16 rows, 1,971 bytes | Includes `profile_json`, `last_updated`, platform rostership percentages. |
| `/api/v1/player/lamarjacksonqb?year=2026` | `200` | array | 1,877 rows, 1,918,781 bytes | Historical value rows from 2021-04-16 through 2026-06-05. |
| `/api/v1/player/details/trade/lamarjacksonqb?year=2026` | `200` | object | `tradeVolume` object, 998 bytes | Player-level trade-volume metadata. |
| `/api/v1/player/points?playerNameId=lamarjacksonqb&year=2026` | `200` | array | 0 rows, 2 bytes | Empty for this query; not evidence of points coverage. |

No auth cookie, bearer token, or API key was required for those public player probes. That does not grant production usage rights.

## Source Selector Map

The bundle exposes these market enum values:

| Enum | Display | Format Bucket | Observed Field Family |
| --- | --- | --- | --- |
| `KeepTradeCut` | KeepTradeCut | dynasty | `trade_value`, `sf_trade_value` |
| `FantasyCalc` | FantasyCalc | dynasty | `fc_trade_value`, `fc_sf_trade_value` |
| `DynastyProcess` | DynastyProcess | dynasty | `dp_trade_value`, `dp_sf_trade_value` |
| `DynastySuperflex` | Fantasy Navigator | dynasty | `ds_trade_value`, `ds_sf_trade_value` |
| `DynastyDaddyADP` | ADP Daddy | dynasty | `adp_trade_value`, `adp_sf_trade_value` |
| `ProFootballNetwork` | Pro Football Network | dynasty | `pfn_trade_value`, `pfn_sf_trade_value` |
| `DraftSharks` | DraftSharks | dynasty | `dss_trade_value`, `dss_sf_trade_value` |
| `DynastyDaddy` | Dynasty Daddy | dynasty | `daddy_trade_value`, `daddy_sf_trade_value` |
| `KeepTradeCutRedraft` | KeepTradeCut | redraft | `ktc_rd_trade_value`, `ktc_rd_sf_trade_value` |
| `FantasyCalcRedraft` | FantasyCalc | redraft | `fc_rd_trade_value`, `fc_rd_sf_trade_value` |
| `DyanstyDaddyADPRedraft` | ADP Daddy | redraft | `adp_rd_trade_value`, `adp_rd_sf_trade_value` |
| `DynastySuperflexRedraft` | Fantasy Navigator | redraft | `ds_rd_trade_value`, `ds_rd_sf_trade_value` |
| `ProFootballNetworkRedraft` | Pro Football Network | redraft | `pfn_rd_trade_value`, `pfn_rd_sf_trade_value` |
| `DraftSharksRedraft` | DraftSharks | redraft | `dss_rd_trade_value`, `dss_rd_sf_trade_value` |
| `RedraftDaddy` | Fantasy Daddy | redraft | `daddy_rd_trade_value`, `daddy_rd_sf_trade_value` |
| `Madden` | Madden | player ratings | `madden_trade_value` |

The source selector is useful as a feature map, not as a source license. Some listed values appear to be Dynasty Daddy-normalized fields derived from other communities or paid/public sources.

## Lamar Jackson Coverage Sample

The `player/{playerNameId}` history probe returned 1,877 rows with the following non-null field counts:

| Field Family | Non-Null Rows |
| --- | ---: |
| KTC dynasty | 1,877 |
| FantasyCalc dynasty | 1,496 |
| DynastyProcess dynasty | 1,207 |
| Fantasy Navigator dynasty | 1,099 |
| KTC redraft | 1,018 |
| FantasyCalc redraft | 1,017 |
| ADP Daddy dynasty/redraft | 1,009 |
| Pro Football Network dynasty/redraft | 1,877 |
| DraftSharks dynasty/redraft | 1,877 |
| Dynasty Daddy / Fantasy Daddy | 680 |
| Madden | 547 |

Date range: `2021-04-16T12:09:28.936Z` through `2026-06-05T08:06:45.543Z`.

## Feature Mapping

Potentially useful after approvals:

- valuation source coverage comparison
- ADP/value-over-cost benchmarking
- player value movement history
- source disagreement and confidence diagnostics
- trade-volume context for player-detail or trade modules
- competitor feature research for source-selector UX

Not enough evidence for:

- source-backed weekly projection claims
- start/sit recommendations
- waiver rankings
- public provider-attributed claims
- route/usage or depth-chart context
- normal report-load provider calls

## Open Requirements Before Integration

- terms approval for Dynasty Daddy data and any upstream source-derived fields
- exact source/endpoint contract and allowed call cadence
- rate-limit result across normal expected probes
- player ID mapping to Sleeper/GSIS/FantasyPros IDs, not player slug alone
- source freshness semantics per field family
- row coverage across positions, rookies, picks, defenses, and redraft/dynasty formats
- attribution language for Dynasty Daddy and upstream providers
- privacy review before using league/user/team query params or league-infused values
