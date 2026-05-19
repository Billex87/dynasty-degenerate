# Product Research Notes

These notes capture todo research that did not warrant runtime changes tonight.

## FantasyPros VORP

FantasyPros publishes VBD/VORP/VOLS ranking views and describes value-based drafting as maximizing incremental value relative to likely opponent rosters. Support docs explain that draft score uses projections to calculate VORP and compare team strength.

Sources:

- https://www.fantasypros.com/nfl/rankings/vorp.php
- https://support.fantasypros.com/hc/en-us/articles/115005868747-What-is-value-based-drafting-What-do-player-draft-values-mean-VORP-VONA-VOLS-VBD
- https://support.fantasypros.com/hc/en-us/articles/115001354808-What-is-the-Draft-Score-based-on

Recommended product use:

- Treat VORP as a draft-cost/readout layer, not a dynasty market-value source.
- Use it for redraft lineup strength, draft assistant, value-over-cost, and replacement-level context.
- Do not depend on FantasyPros VORP in paid/public outputs until FantasyPros production rights are cleared.

## FantasyPros Matchup Calendar / ECR SOS

FantasyPros publishes a matchup calendar with ECR, player/team rows, and week-by-week matchup ratings. The DST page confirms the same calendar navigation also covers QB, RB, WR, TE, K, and DST, which makes it a strong candidate for schedule-aware streamer logic if usage rights and a stable fetch path are approved.

Sources:

- https://www.fantasypros.com/nfl/matchups/dst.php
- https://support.fantasypros.com/hc/en-us/articles/7927971442459-Why-do-players-at-the-same-position-on-the-same-team-have-different-Strength-of-Schedule-values

Recommended product use:

- Store ECR, position, team, week, opponent, home/away, matchup rating, opponent rank, source URL, fetched timestamp, row count, checksum, and parser version in a scheduled/admin-only snapshot.
- Treat the data as dynamic: refresh snapshots periodically before the season, refresh more often around in-season waiver and start/sit windows, and retain historical versions so ECR/SOS movement can be audited.
- Use ECR as the quality guard: a better-ranked player with two favorable early weeks should beat a fringe option with one green matchup.
- Add all-position rolling ECR into waiver AI Targets first, with D/ST and K available as quick streamer filters rather than the default view.
- Add a Rankings-tab Schedule Edge table for browsing the same data by position and week range; keep it secondary to the core rankings so dynasty values are not visually replaced by short-term matchup context.
- Keep D/ST/K pairing logic as a specialized streamer view, then let QB/RB/WR/TE reads use the same ECR window alongside projection, usage, and roster-need context.
- Keep normal report loads snapshot-backed and avoid public-page live scrapes until FantasyPros terms and attribution/display limits are cleared.

## Sleeper Draft/Trade Data Beyond Our Leagues

Sleeper exposes league-scoped drafts, draft picks, traded picks, and transactions. The official docs do not show a global public trade or draft database endpoint. Product direction should assume we can store data only from leagues users load or explicitly share.

Source:

- https://docs.sleeper.com/

Recommended product use:

- Build our own opt-in historical trade/draft corpus from analyzed/shared leagues.
- Store only normalized, product-useful facts: player IDs, pick IDs, roster IDs, timestamps, league format, scoring settings, and outcome labels.

## Fantasy Football + AI Product Patterns

Repeated patterns from current AI fantasy products and community discussions:

- draft-room overlays and Chrome extensions
- league-sync personalization
- chat assistant for roster questions
- trade analyzer with partner fit and impact explanation
- waiver prediction and alerting
- scenario simulator for draft or trade choices
- AI-generated team report/newsletter
- transparent data freshness and source caveats

Sources reviewed:

- Drafty real-time Chrome extension positioning: https://drafty.club/
- WinMyLeague AI learning/tool page: https://www.winmyleague.ai/learn
- FantasyLife synced tool suite: https://www.fantasylife.com/tools
- IBM/ESPN AI insights example: https://newsroom.ibm.com/2025-09-24-new-ibm-watsonx-ai-powered-insights-help-elevate-espn-fantasy-football-for-2025-fantasy-football-season

Best next feature candidates:

- draft-room companion extension that reads platform draft state and overlays our tier/value/opportunity notes
- report chat that answers only from the current report payload and source trace
- weekly briefing email generated from stored league snapshots

## Chrome Extension Outline

Minimum useful extension:

- content scripts for Sleeper, ESPN, Yahoo, and MFL draft rooms
- live drafted-player detection
- panel with best available by blended value, VORP, roster need, tier breaks, stack/correlation, bye windows, and league format
- manual fallback controls if platform DOM changes
- no credentials stored in extension unless OAuth/account linking is implemented
- server endpoint receives league ID plus selected provider and returns compact draft assistant payload

Important risks:

- platform DOMs change often
- extension cannot expose third-party provider raw data if licensing forbids it
- latency has to stay low enough for draft timers

## AI Chatbot Trace

Current codebase status:

- `client/src/components/AIChatBox.tsx` is a reusable UI component.
- `client/src/pages/ComponentShowcase.tsx` demonstrates it with fake/demo responses.
- No production report chatbot route or tRPC mutation is wired from the search pass.

Recommended direction:

- Implement a report-scoped assistant only after we define retrieval boundaries.
- Inputs should be current `ReportData`, source diagnostics, and saved user/league context.
- The assistant should cite report sections and refuse unsupported live claims when no source payload exists.

## Dynasty Daddy Feature Ideas

The target Dynasty Daddy page is JavaScript-rendered, so search-indexed/public text was more useful than static HTML. Public material describes league-tied player values, trade calculations, season simulations, league statistics, portfolio/exposure, and multi-platform support.

Sources:

- https://dynasty-daddy.com/fantasy-rankings
- https://www.patreon.com/DynastyDaddy

Useful ideas for us:

- multiple value-source toggles in player rankings
- league-context player page that shows ownership, team fit, and trade partners
- trade tree/history from a manager or player perspective
- portfolio/exposure view across all synced leagues
- predicted pick value based on projected team finish
