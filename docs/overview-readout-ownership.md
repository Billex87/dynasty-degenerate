# Overview Readout Ownership

This matrix keeps the Overview tab from repeating the same conclusion across multiple surfaces. Each surface gets one primary job, an allowed metric/readout set, and banned overlap.

## Surface Ownership Matrix

| Surface | Primary Job | Allowed Readouts | Banned Overlap | Source Of Truth |
| --- | --- | --- | --- | --- |
| `OverviewAIPulse` | Narrative league story | league state, top storyline, confidence caveat, next theme | table-level ranks, repeated manager advice, duplicated roster counts | `leagueDiagnostics`, `leagueOverview`, `leagueAiConfidence` |
| `Monthly Team Blueprint` | Long-horizon roster plan | team direction, age curve, roster construction, monthly action plan | league-wide power ranking, trade partner ranking, weekly matchup copy | `monthlyBlueprint`, manager confidence, roster construction signals |
| `League Power Rankings` | League-wide strength/value order | league rank, value rank, contender/rebuilder posture | owner-level next move, detailed roster gap copy | `powerRankings`, `leagueOverview` |
| `Team Breakdown & Roster Recon` | Roster strengths, leaks, surplus, next move | position strength, roster health, starter/bench shape, surplus/need | re-ranking the whole league, trade partner fit | `managerRosterIntelligence` |
| `Trade Finder, Partners & League Exploits` | Trade opportunity and pressure points | trade partner fit, exploitable surplus/need, tradeable depth, offer posture | roster-health summary, league power rank | `managerRosterIntelligence`, `tradeTendencies`, `tradeProposalSignals` |
| `Assistant Feature Radar` | Placeholder/shell inventory | available modules, unavailable modules, roadmap status | active analysis, manager-specific advice, repeated metrics | static feature inventory |
| `OwnerIntelMatrix` | Owner identity and strategy tags | owner identity, roster identity, comp lanes, strategy labels | table-level roster counts, power ranking claims | `managerRosterIntelligence`, `tradeTendencies` |
| `LeagueCommandCenter` roster mode | Weekly lineup/bench readiness | projected starters, bench depth, step-ins, injury insurance, season read | taxi decisions, trade-partner copy | `managerPositionCounts`, `managerRosterIntelligence`, `matchupPreviews` |
| `LeagueCommandCenter` taxi mode | Taxi decisions | promote, park, cut, monitor, taxi counts | active lineup depth, trade advice | `taxiTriage` inside `managerRosterIntelligence` |
| `Manager Position Counts` | Position depth and imbalance | position counts, starter count, active/reserve/taxi counts, imbalance | strategy narrative, power rank, trade partner fit | `managerPositionCounts` |

## Concept Owners

| Concept | Owner | Allowed Secondary Use |
| --- | --- | --- |
| League value rank | `League Power Rankings` | `OverviewAIPulse` can mention one broad league-story summary without repeating ranks. |
| Starter count / starter room | `Manager Position Counts` | `LeagueCommandCenter` can use selected starter rows for weekly actions. |
| Bench depth | `LeagueCommandCenter` roster mode | `Team Breakdown & Roster Recon` can summarize only when explaining a roster leak. |
| Age and age flags | `Monthly Team Blueprint` | `Team Breakdown & Roster Recon` can mention a single age-risk reason. |
| Roster health | `Team Breakdown & Roster Recon` | `OverviewAIPulse` can summarize league-wide health trend. |
| Position imbalance | `Manager Position Counts` | `Trade Finder` can reference only when creating a partner fit. |
| Tradeable depth | `Trade Finder, Partners & League Exploits` | `Team Breakdown` can list surplus position without naming trade targets. |
| Trade partner fit | `Trade Finder, Partners & League Exploits` | no secondary owner |
| Taxi promote/park/cut calls | `LeagueCommandCenter` taxi mode | no secondary owner |
| Top-manager or best-team claims | `League Power Rankings` | `OverviewAIPulse` can mention only the current league story. |

## Review Rule

If a concept appears in two places, the second instance must answer a different user question. Repeated wording, repeated ranks, repeated value tags, and repeated best/worst labels should be removed or rewritten during review.

