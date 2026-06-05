# FantasyPros Endpoint Feature Audit

This audit maps documented FantasyPros NFL API endpoints to Dynasty Degens features and AI readouts. FantasyPros data must stay server-only, snapshot-backed, and rate-limit protected. Normal user-triggered report loads should read stored snapshots only.

Sources:

- FantasyPros API docs: https://api.fantasypros.com/v2/docs
- FantasyPros API access terms: https://support.fantasypros.com/hc/en-us/articles/49749297704475-How-do-I-request-access-to-the-FantasyPros-API

## Current Local Probe Result

The local key is configured. The paced expanded smoke on May 19, 2026 returned:

- Loaded: `DRAFT`, `ROS`, `DYNASTY`, `DEVY`, `ROOKIES`, `ADP`, `DYNADP`, `RKADP`, `players`, `news`, `injuries`, `player-points`, weekly `QB` ECR for Week 1, `compare-players`, and `projections`.
- Reachable but currently empty: `WW` rankings for Week 1 returned `200` with zero rows and `last_updated` of `1/01`.
- Blocked for this key/package: `targets` and `articles` returned `403 Forbidden`.

Current gate status:

- Projections: blocked for public projection claims until commercial/source rights, endpoint freshness, normal rate limits, and mapping coverage are approved.
- `WW`: research only until closer-to-season snapshots return non-zero rows.
- Targets and articles: blocked until package access returns `200` and usage terms are approved.
- News: snapshot/research only until production coverage, cadence, rate limits, and attribution terms are confirmed.

Endpoint pacing is now implemented in the FantasyPros health check and smoke script. Expanded probes are opt-in, each request is delayed, `Retry-After` is captured, and the run stops after a `429` so one broad check does not burn through the package limit.

Run the full metadata check with:

```sh
CHECK_FANTASYPROS_EXPANDED=true CHECK_FANTASYPROS_PROJECTIONS=true pnpm run check:fantasypros
```

Do not turn the result into public provider-attributed claims unless `docs/projection-source-readiness-gates.md` also moves the specific endpoint to `approved-for-public-claim`.

Weekly ECR ingestion is position-specific because Week 1 `position=ALL` returned `400 Bad Request` while position requests returned rows. Expanded health checks and endpoint snapshots now fan out QB/RB/WR/TE/K/DST across a rolling week window keyed by the current NFL week plus `FANTASYPROS_SNAPSHOT_WEEK_WINDOW`; scheduled refreshes resolve the current week from Sleeper NFL state with an env fallback, while report diagnostics use the loaded league's live schedule week.

Endpoint payload snapshot writing is also available behind `ENABLE_FANTASYPROS_ENDPOINT_SNAPSHOTS`. It stores successful responses in `providerDataSnapshots` under `fantasypros-endpoint-v1:{season}:{scoring}:{endpointKey}` and keeps the same pacing/stop-on-429 behavior. Expanded endpoint snapshots require `ENABLE_FANTASYPROS_EXPANDED_SNAPSHOTS` or the expanded-health flag. The normal endpoint-snapshot scrape runs weekly on Tuesdays at noon Pacific; daily dynamic-data refreshes only run it when `ENABLE_FANTASYPROS_ENDPOINT_SNAPSHOTS_DAILY` is explicitly enabled after package limits prove it is cheap enough.

Stored snapshot reads now have a normalized server-side context for weekly ECR, rolling position/week ECR, `WW`, projections, player-points, player/external IDs, and compare-player rows. The context only reads `providerDataSnapshots`; report/admin diagnostics receive row counts from that context. FantasyPros matchup-calendar pages are retired from active SOS refresh/readout paths.

DraftSharks is the schedule-strength source. FantasyPros `matchups/{position}.php` parsing should stay historical/test-only unless a future non-SOS use case is explicitly approved. Weekly ECR remains useful as rank/relevance context, but matchup wording should say "rank", not "SOS".

## Endpoint Map

| Endpoint | Returns | Product Use | AI Readout Use | Priority |
| --- | --- | --- | --- | --- |
| `nfl/{season}/consensus-rankings` | ECR, min/max/average rank, standard deviation, position rank, expert count, player/team IDs, scoring, week, ranking type. Supports `ROS`, `DK`, `WW`, and `ADP` per docs. | Dynasty/redraft/devy rankings, weekly ECR, waiver-wire ranking, expert-spread confidence, value-over-cost, source trace. | "Consensus has this player ahead, but expert spread is wide", "waiver rank is stronger than current roster alternatives", "start/sit edge is small." | High |
| `nfl/{season}/projections` | Projected fantasy points and stat components by week, position, scoring, and expert filter. Includes QB/RB/WR/TE/K/DST/IDP fields. | Lineup strength, matchup previews, start/sit, redraft valuation, D/ST and kicker streamer projection support, projection accuracy backtests. | "Projection edge comes from volume, not touchdown dependency", "D/ST projection is sack/turnover supported", "kicker projection is field-goal attempt driven." | High, gated |
| `nfl/{season}/targets` | Weekly target counts by player/team/position. | Waiver role growth, usage trend alerts, receiver/TE/RB pass-game opportunity, post-injury role shifts. | "Targets are rising before box-score value catches up", "role is real enough to stash", "volume is thin despite points." | High |
| `nfl/{season}/player-points` | Fantasy points, games, average, and weekly points by player/position/scoring. | Boom/bust consistency, projection backtests, prior-season outcome labels, value-confidence calibration, draft-outcome warehouse. | "This player has volatile weekly output", "projection source historically missed this player archetype", "role produced usable points when active." | High |
| `nfl/players` | FantasyPros player IDs, names, positions, teams, player URLs, rank fields, age/birthdate, and some external IDs. | Cross-source identity matching, source trace, platform joins, modal source links, FantasyPros player-page references. | "Matched by FantasyPros ID instead of fuzzy name", "source confidence is lower because identity is ambiguous." | High |
| `nfl/news` | Player news items with title, team, link, timestamp, and categories such as injury, recap, transaction, rumor, and breaking. | News-to-value movement, player modal news, injury/transaction context, source freshness. | "Value moved after injury news", "this is transaction context, not performance decline", "news is stale." | Medium |
| `nfl/compare-players` | Expert rank comparisons for two to four players by position and ranking type, optionally with player/expert details. | Player modal comparison, start/sit explainers, trade side-by-side context, close-call confidence. | "Experts prefer Player A, but the edge is close", "ROS consensus favors the trade target while weekly rank favors the incumbent." | Medium |
| `nfl/articles` | Article metadata, category, author, image, URL, and article text/summary fields. | Research Assistant context, content-aware player notes, optional editorial reference, source-discovery queue. | "Recent FantasyPros analysis supports monitoring this role", with attribution and freshness caveats. | Low/Medium |
| `nfl/injuries` | Injury/practice-report status when available to the API package. | Availability risk, lineup confidence, player modal health notes, stale injury diagnostics. | "Recommendation confidence is capped because injury status is unresolved." | Medium, verify package |

## Highest-Value Additions We Are Not Fully Using

1. Add `targets` snapshots.
   - This is the cleanest immediate upgrade for waiver intelligence because it supports role-growth alerts without waiting for projection access.
   - Join with existing nflverse usage snapshots to avoid overreacting to one target spike.

2. Use rolling weekly ECR and `WW` ranking type.
   - Weekly ECR can improve start/sit and streamer reads across QB/RB/WR/TE/K/DST.
   - `WW` rankings could directly rank waiver candidates instead of forcing waiver logic to infer from draft or ROS ranks.

3. Normalize projection snapshots after rate-limit behavior is controlled.
   - Store source/version metadata before using projections in public lineup-strength, matchup, or confidence calculations.
   - Keep D/ST and K projection support separate from SOS-only streamer logic.

4. Add expert-spread confidence from consensus rankings.
   - Use `rank_min`, `rank_max`, `rank_ave`, and `rank_std` to lower confidence when experts disagree.
   - This is useful for AI readouts because it can explain uncertainty without inventing reasons.

5. Add compare-player snapshots for close calls only.
   - Do not run compare-player broadly across every report.
   - Use it for selected player-modal, start/sit, and trade comparison flows where the user is choosing between two to four players.

## AI Readout Boundaries

- Say "FantasyPros ECR/rankings" only when the stored row actually came from the rankings endpoint.
- Say "FantasyPros projection" only when a fresh projection snapshot exists for the relevant scoring/week.
- Say "usage trend" for targets/player-points; do not label targets as route participation.
- Say "expert disagreement" only when expert spread fields are stored.
- Do not display FantasyPros player images unless Sportradar/FantasyPros image rights are separately approved.
- Do not call FantasyPros live inside user-triggered report, player-modal, ranking, or AI readout paths.

## Implementation Order

1. Resolve package access for `targets` and `articles` before depending on those rows.
2. Surface admin-only per-player source trace from the normalized snapshot context.
3. Build the Rankings-tab Schedule Edge table against stored DraftSharks SOS snapshots first, showing all positions with D/ST/K streamer pairings as the first high-signal filter.
4. Expand AI readouts only after snapshot freshness and identity matching pass diagnostics.

## Re-Review Timing

Re-review this baseline in August 2026, when current-season weekly projections, `WW`, targets, injuries, and depth-chart package rows should be more mature. Treat a May/June 200 response with stale or zero rows as insufficient evidence for waiver, lineup, matchup, or redraft claims.
