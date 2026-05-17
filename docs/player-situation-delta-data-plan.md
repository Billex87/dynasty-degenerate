# Player Situation Delta Data Plan

Goal: make player AI reads understand why a player's future opportunity is changing, not just whether current value or last year's production looks good. This applies to rookies, sophomores, veterans in new situations, veterans whose teams changed around them, and players whose coaches or offensive environments changed.

## Current Answer

We have enough public and stored data to build a strong first version of Player Situation Delta without adding live report-load calls:

- player usage: targets, carries, receptions, PPR points, target share, WOPR, air-yard share, snap percentage
- team environment: team pass attempts, carries, target volume, receiving air yards, EPA-style passing/rushing fields, and play-by-play pass/run tendency
- roster context: rosters, weekly rosters, depth charts, same-position additions, same-position losses, and vacated volume
- prospect priors: Draft Buzz rankings, size, speed, scouting summaries, draft class, college, and draft capital
- investment runway: nflverse/ffverse draft metadata, combine, and contract snapshots
- advanced public efficiency: Next Gen Stats receiving/rushing, PFR advanced receiving/passing/rushing, and public FTN charting concepts

The biggest missing signal is true route volume and yards per route run. Public nflverse participation data has offensive personnel and the primary receiver route for a play, but not every eligible receiver's route on every dropback. Any route read from that source should be labeled as an estimated route-participation proxy. True routes run, route share, first-read targets, separation by route, and YPRR should stay behind a licensed-source gate until we have approved access.

## Source Coverage

| Signal | Current Status | Best Available Source | How It Should Power Reads | Caveat |
| --- | --- | --- | --- | --- |
| Last-season player volume | Wired first pass | Sleeper season stats, nflverse `stats_player` | role growth, usage floor, production shape | aggregate `stats_player` rows do not provide short-window trends |
| Target share, air-yard share, WOPR | Wired first pass | nflverse `stats_player` | WR/TE demand quality, pass-game role growth | strongest when paired with team pass volume |
| Team run/pass tendency | Wired first pass | nflverse `stats_team`, `pbp` | coach/team environment, redraft volume confidence, dynasty opportunity boosts | coach/play-caller attribution still needs a curated coaching snapshot |
| Snap share | Wired first pass | nflverse `snap_counts` | role stability, player on-field trust, backup runway | offensive snap percentage is not route share |
| Personnel and primary route tags | Available next | nflverse `pbp_participation` | formation tendencies, estimated pass-game participation, coverage/route context | route is primary receiver only, not full route volume |
| Motion, play action, RPO, screens | Available next | nflverse FTN charting release | scheme fit, QB/RB/WR context, offense identity | public release is play-level charting, not a full route-volume feed |
| NGS receiving and rushing | Available next | nflverse `nextgen_stats` | separation, cushion, YAC over expected, rushing efficiency, box count pressure | mostly target/carry-based, so low-volume samples need confidence caps |
| PFR advanced receiving/passing/rushing | Available next | nflverse `pfr_advstats` | ADOT, drops, YAC, bad throws, pressure, broken tackles | does not include true routes run |
| Depth chart changes | Wired first pass | ESPN depth charts, nflverse `depth_charts` | crowded room, vacated role, veteran at-risk reads | depth chart semantics vary by source and team |
| Team/offseason roster movement | Wired first pass | nflverse rosters, weekly rosters, trades, depth charts, and prior-season player stats | same-position additions/losses, typed trade/draft/free-agent-style movement, movement quality tiers, vacated targets/carries, incoming threat score, incumbent promotion score, player opportunity deltas | non-trade transaction labels are inferred from roster timing/draft metadata until a broader official transaction feed is approved |
| Coach / coordinator / play caller | Missing source | curated official-team/PFR/NFL source snapshot | scheme-change boost/risk, play-caller tendency transfer, player fit notes | current staff data is volatile; every row needs source URL and freshness |
| True routes, route share, YPRR | Missing licensed source | Fantasy Points Data Suite, PFF, SportsDataIO/FantasyData, FTN Data, or another approved vendor | WR/TE breakout quality, target quality, first-read confidence | do not present as exact until licensed data is available |

## Historical Coverage To Lean On

Use `pnpm audit:situation-delta-sources` to refresh this locally. Current probe targets:

| Dataset | Why It Matters |
| --- | --- |
| Sleeper season stats | Existing app-friendly player stat history; current refresh starts at 2017. |
| nflverse `stats_player` | Season/week player volume and receiving market share; public releases extend much farther back than Sleeper. |
| nflverse `stats_team` | Team volume, pass/rush split, and offense-level context. |
| nflverse `pbp` | Situation-aware pass/run rate, pace, neutral-script tendencies, red-zone tendencies, and game-script filtering. |
| nflverse `snap_counts` | Offensive snap percentage and role stability. |
| nflverse `pbp_participation` | Formation, personnel, pressure, primary receiver route, and coverage context. |
| nflverse `nextgen_stats` | Receiver separation/cushion/YAC over expected and RB rushing efficiency/box counts. |
| nflverse `pfr_advstats` | ADOT, YAC, drops, bad throws, pressure, broken tackles, and QB rating when targeted. |
| nflverse `ftn_charting` | Motion, play action, RPO, screens, no-huddle, catchable/drop style charting. |
| nflverse `depth_charts`, `rosters`, `weekly_rosters` | Opportunity competition, same-position room changes, and team changes. |
| Draft Buzz / ESPN prospects | Prospect priors for rookies and young-player historical cohorts. |

## Current Audit Snapshot

Last refreshed locally with `pnpm audit:situation-delta-sources` on 2026-05-17.

| Dataset | Current Observed Coverage |
| --- | --- |
| nflverse `stats_player` | 542 release assets, 1999-2025 |
| nflverse `stats_team` | 542 release assets, 1999-2025 |
| legacy nflverse `player_stats` | 1822 release assets, 1999-2024 |
| nflverse `snap_counts` | 73 release assets, 2012-2025 |
| nflverse `pbp` | 160 release assets, 1999-2025 |
| nflverse `pbp_participation` | 46 release assets, 2016-2025 |
| nflverse `nextgen_stats` | 95 release assets, 2016-2024 |
| nflverse `pfr_advstats` | 190 release assets, 2018-2025 |
| nflverse `ftn_charting` | 18 release assets, 2022-2025 |
| nflverse `depth_charts` | 109 release assets, 2001-2026 |
| nflverse `injuries` | 73 release assets, 2009-2025 |
| nflverse `weekly_rosters` | 100 release assets, 2002-2025 |
| nflverse `rosters` | 434 release assets, 1920-2026 |
| Draft Buzz historical supplement | 720 players, 2021-2025, QB/RB/WR/TE |
| Draft Buzz indexed/future supplement | 287 players, 2026-2027, QB/RB/WR/TE |
| Draft Buzz current snapshot | 122 players, 2027, QB/RB/WR/TE |
| ESPN college prospect snapshot | 21 players, 2028, QB/RB/WR/TE |

Two important implementation notes came out of the audit:

- the current `nflversePlayerContext` loader now points at season-specific `stats_player_reg_{season}.csv`, while the legacy combined `player_stats.csv` remains a historical reference only
- public nflverse sources give us very strong opportunity and efficiency context, but not exact routes run or YPRR

## Readout Model

Create a `playerSituationDelta` layer with component scores rather than one opaque number:

| Component | Inputs | Readout Examples |
| --- | --- | --- |
| Prior opportunity | last 1-3 seasons of targets, carries, snaps, fantasy points, target share, WOPR | "role grew before the market moved", "thin usage despite box-score points" |
| Team volume shift | team pass/rush rate, target volume, pace, red-zone plays, QB change | "new environment has less passing volume", "run-heavy team caps WR2 ceiling" |
| Same-position room | depth chart, rosters, weekly rosters, drafted players, free-agent/trade additions/losses | "crowded room", "vacated slot role", "new Day 2 pick threatens runway" |
| Player investment | draft capital, contract APY/guarantees, years remaining, age phase | "front office patience likely", "late-round profile needs faster proof" |
| Efficiency quality | target share, air-yard share, WOPR, NGS separation/YAC, PFR ADOT/drops/YAC | "earned high-value targets", "production came from fragile TD/YAC spike" |
| Scheme fit | team pass/run split, personnel groupings, motion/play-action/RPO, coach/play-caller history | "scheme boost", "new play caller risk", "run-game friendly setup" |
| Prospect prior | Draft Buzz rank, size/speed, scouting tags, draft year, college, combine | "athletic upside still supports patience", "prospect profile was already thin" |
| Confidence guardrails | sample size, source freshness, missing route data, conflicting signals | "source-limited", "estimated route signal", "strong read eligible" |

## User-Facing Labels

Use short, explainable labels that can appear in player detail, waiver, trade, and portfolio reads:

- role boost
- role threat
- crowded room
- vacated opportunity
- scheme boost
- scheme risk
- new-team uncertainty
- fragile breakout
- veteran runway
- opportunity cliff
- draft-capital patience
- late-capital urgency
- source-limited route read

## Implementation Order

1. Done: migrate the current nflverse usage loader from the legacy combined `player_stats.csv` source to season-specific `stats_player` releases so last-completed-season coverage stays fresh.
2. Done: add team-environment snapshots from nflverse `stats_team` for team pass rate, rush rate, target volume, play volume, and offensive tendency.
3. Done first pass: add play-by-play splits for neutral-script pass rate, red-zone tendency, estimated pace, no-huddle rate, and garbage-time filtering.
4. Done first pass: add roster-room delta snapshots from nflverse rosters and depth charts for same-position additions/losses, rookie/premium additions, crowding, and likely vacated opportunities.
5. Done first pass: expand roster-room deltas with weekly rosters and nflverse trades so movement can distinguish draft picks, trades, inferred free-agent/claim adds, injury returns, and practice-squad/depth churn.
6. Done first pass: quality-weight roster movement with prior-season targets, carries, receptions, PPR production, target share, WOPR, movement impact score, net opportunity score, and incumbent promotion signal so JSN-style breakout windows can be detected from vacated alpha volume plus depth-chart promotion.
7. Add a broader official transaction feed or licensed provider if we want waiver claims, releases, reserve-list moves, and exact free-agent signing dates instead of inferred non-trade labels.
6. Add public advanced-efficiency snapshots from Next Gen Stats, PFR advanced stats, FTN charting, and participation/personnel. Mark route-derived participation as estimated.
7. Add a curated coaching-staff snapshot with team, head coach, offensive coordinator, play caller if known, previous team, first season, source URL, and verified date.
8. Build the `playerSituationDelta` scorer and attach it to player detail AI traces, waiver reads, trade chips, and rankings confidence.
9. Backtest the labels against historical seasons before letting the UI make strong claims.
10. Add a licensed route/YPRR source only after approved terms and endpoint coverage are confirmed.

## Coach / Scheme Source Rule

Coaching data changes too often to trust memory or a one-time scrape. Store it as a source snapshot with explicit fields:

- `season`
- `team`
- `headCoach`
- `offensiveCoordinator`
- `playCaller`
- `firstSeasonWithTeam`
- `priorTeam`
- `priorRole`
- `sourceUrl`
- `verifiedAt`
- `notes`

Preferred sources are official team staff pages, team announcements, NFL.com team/news pages, and Pro Football Reference team pages. If a row is inferred from reporting instead of official staff pages, mark it as `reported` and reduce confidence.

## Licensed Route Data Gate

Do not display exact "routes run", "route share", "targets per route run", or "yards per route run" unless the source explicitly provides route-volume data and our use is approved. Until then:

- use `estimated route participation` only where the estimate is derived from offensive personnel/pass-play participation
- keep confidence capped
- show a missing-signal note on strong WR/TE reads
- prefer target share, air-yard share, WOPR, ADOT, NGS separation, and PFR YAC/drop context for public-data WR/TE reads
