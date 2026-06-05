# FantasyPros Endpoint Feature Audit

This audit maps documented FantasyPros NFL API endpoints to Dynasty Degens features and AI readouts. FantasyPros data must stay server-only, snapshot-backed, and rate-limit protected. Normal user-triggered report loads should read stored snapshots only.

Sources:

- FantasyPros API docs: https://api.fantasypros.com/v2/docs
- FantasyPros API access terms: https://support.fantasypros.com/hc/en-us/articles/49749297704475-How-do-I-request-access-to-the-FantasyPros-API

## Current Local Probe Result

The local key is configured. June 5, 2026 paced expanded/projection probes returned metadata-only evidence:

- Earlier same-day probe loaded current rows: `DRAFT`, `ROS`, `DYNASTY`, `DEVY`, `ROOKIES`, `ADP`, `DYNADP`, `RKADP`, `players` with 8,434 rows, `news` with 25 rows, `injuries` with 6 rows, `player-points` with 2,166 rows, `compare-players`, and `projections` with 597 rows.
- Later same-day full expanded/projection rerun stopped on `429` at `weekly-ecr:DST:week1` after loading ranking/player/news/injury/player-points metadata; remaining expanded endpoints and projections were skipped.
- Latest same-day full expanded/projection rerun stopped immediately on `429` at `rankings:DRAFT`; every remaining endpoint was skipped by the stop-on-429 guard.
- Weekly ECR: Week 1 position-specific `QB`/`RB`/`WR`/`TE`/`K`/`DST` requests returned rows with `last_updated` of `5/18`; Week 2 and Week 3 returned `200` with zero rows and `last_updated` of `1/01`.
- Reachable but currently empty: `WW` rankings for Week 1 returned `200` with zero rows and `last_updated` of `1/01`.
- Blocked for this key/package: `targets` and `articles` returned `403 Forbidden`.
- Rate-limit behavior: the latest full rerun hit `429` before the first rankings payload completed, so the expanded/projection cadence is not validated under normal rate limits.

Current gate status:

- Projections: research-only. The endpoint currently returns rows, but normal report loads, model weighting, stored production snapshots, and public projection claims remain blocked until commercial/source rights, stored freshness metadata, normal cadence/rate limits, mapping coverage, and attribution language are approved.
- `WW`: research only until closer-to-season snapshots return non-zero rows.
- Targets and articles: blocked until package access returns `200` and usage terms are approved.
- News: snapshot/research only until production coverage, cadence, rate limits, and attribution terms are confirmed.

## Resolved Product Logic, June 5 2026

1. Primary player value is the Dynasty Degens weighted/blended valuation output, not raw KTC and not raw FantasyPros. FantasyPros can contribute through the existing source weighting only when stored, fresh, and approved rows exist. Current FantasyPros "values" in the backend are rank-to-value normalizations from ECR/ADP/ranking fields, so do not describe them as native FantasyPros player values.

2. Waiver cards should lead with claim-over-drop value and roster fit from the app blend, then layer in stored weekly-rank context when fresh. Weekly rank supports short-term startability, ROS rank supports hold value, waiver rank supports priority when non-empty, and expert spread/confidence should lower certainty when analysts disagree. If ranking rows are stale, empty, gated, or missing, the card falls back to blended value/rank without making a provider-branded claim.

3. Trade cards should lead with blended value edge plus roster-fit context, then show player-level values and ranks. Side totals use app-blended player values; pick value needs a separate pick valuation path before it can be included in the quick pending-card total. The Trade War Room remains the deeper surface for starter impact, roster fit, manager leverage, and acceptance reads.

4. Schedule Edge uses the stored schedule/SOS snapshot only for now. Weekly rank can support startability context later, but it must not feed Schedule Edge, SOS, matchup-grade, or schedule-strength labels unless a future approved schedule source explicitly supports that use.

5. Projections belong in weekly and seasonal decision layers after approval: lineup strength, start/sit, streamers, redraft waivers, and weekly matchup reads. They must not override dynasty asset value. In dynasty contexts, projections can explain short-term contender/rebuilder fit, fragile projection spikes, or immediate starter pressure, but the core value stays the app's blended dynasty value.

6. Missing or stale provider rows should not create provider-branded claims. If rankings, weekly rank, waiver rank, projections, news, or other rows are stale, empty, gated, blocked, or missing, user-facing and admin-facing cards fall back to the app's blended/internal value and suppress provider labels. Internal trace data may retain source keys for troubleshooting. Rendered cards should describe stale or missing evidence only when it materially changes the recommendation, confidence cap, or actionability.

7. Expert-spread fields should feed confidence first. Low-disagreement rows can add a small confidence boost and show a simple "Stable consensus" badge when useful; high-disagreement rows should lower confidence and may show "Wide expert range" or "Volatile expert read" when the badge changes the read. Keep raw best/worst/average/std-dev values in source diagnostics or internal trace detail instead of making normal cards display the math.

8. D/ST and K should behave like normal lineup assets in redraft, waiver, streamer, lineup, and schedule contexts: show positional rank, season value, projections/ranks when approved, and stored schedule/SOS when available. In dynasty trade/value contexts, treat D/ST and K as season-only lineup pieces. Display their rank/value context when the league uses those slots, but do not include them in long-term dynasty quick trade side totals or label their value as a core dynasty asset. Schedule/SOS supports their lineup context, not a dynasty market rank/value.

9. Public and admin recommendation surfaces should follow the same source-label rule: the Dynasty Degens blended value/recommendation is the product output. Provider data is evidence inside the blend and freshness gates, not a separate displayed truth. Rendered recommendation UI and AI copy should say "blended value," "weekly rank," "schedule context," "stored projection," "stored news," or "blend evidence" instead of provider-branded value labels. Do not write recommendation copy as "FantasyPros says" or "DraftSharks says." Internal storage, logs, tests, legal/attribution pages, and true diagnostics such as Source Coverage can keep provider/source keys and provider names for verification and compliance.

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

- Say "weekly rank" or "stored ranking" when the stored row came from a ranking endpoint; keep provider names out of recommendation copy.
- Say "stored projection" only when a fresh projection snapshot exists for the relevant scoring/week.
- Suppress provider labels when the relevant stored row is stale, empty, gated, blocked, or missing; keep source keys internal outside legal pages and true source diagnostics.
- Mention stale or missing stored evidence only when it changes confidence, actionability, or the recommended next step.
- Say "usage trend" for targets/player-points; do not label targets as route participation.
- Say "expert disagreement" only when expert spread fields are stored.
- Do not display FantasyPros player images unless Sportradar/FantasyPros image rights are separately approved.
- Do not call FantasyPros live inside user-triggered report, player-modal, ranking, or AI readout paths.

## Implementation Order

1. Resolve package access for `targets` and `articles` before depending on those rows.
2. Surface per-player blend evidence and freshness diagnostics from the normalized snapshot context without provider-branded recommendation labels.
3. Build the Rankings-tab Schedule Edge table against stored DraftSharks SOS snapshots first, showing all positions with D/ST/K streamer pairings as the first high-signal filter.
4. Expand AI readouts only after snapshot freshness and identity matching pass diagnostics.

## Re-Review Timing

Re-review this baseline in August 2026, when current-season weekly projections, `WW`, targets, injuries, and depth-chart package rows should be more mature. Treat a May/June 200 response with stale or zero rows as insufficient evidence for waiver, lineup, matchup, or redraft claims.
