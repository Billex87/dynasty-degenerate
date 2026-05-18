# Redraft Draft Strategy Source Audit

Last reviewed: May 18, 2026.

This audit is for the future Redraft Draft Coach and draft-outcome warehouse. The goal is not to copy another site's rankings. The goal is to find enough draft-cost, roster-construction, and season-outcome evidence to answer questions like:

- Which position paths actually win in comparable formats?
- When should the app recommend early QB, hero RB, zero RB, early TE, or balanced starts?
- Which players were draft-day values, role misses, injury misses, waiver winners, or league-winner picks?
- Which public benchmarks can train our priors before we have enough Dynasty Degens user-loaded redraft leagues?

## Current Verdict

There are useful public benchmarks, but I did not find a clean public dataset that already gives exact champion draft-position sequences at scale, such as `RB-WR-QB-TE` for every league winner.

The best path is a two-layer model:

1. **Public benchmark layer:** use published league-winner and draft-cost studies to set strategy priors by position, round, ADP bucket, format, and player archetype.
2. **Dynasty Degens aggregate layer:** from user-loaded or explicitly shared leagues, compute only anonymized aggregate percentages for champion/top-finish draft paths. Do not store raw third-party league history unless a user explicitly opts in or the league is already part of our app state.

## Source Audit

| Source | Access posture | What it gives us | What it does not give us | Product use |
| --- | --- | --- | --- | --- |
| Sleeper public API | Official public endpoints by known user, league, or draft ID. No confirmed global league directory. | League settings, roster settings, wins/losses/points, drafts, draft picks with round/slot/pick/player metadata, matchups, transactions, and user public leagues by user ID. | A public "all leagues" endpoint or global winner dataset. | Primary aggregate analyzer for user-loaded/shared leagues. Use to compute champion draft paths, draft slot outcomes, winner position sequences, and format buckets. |
| FantasyPros API | API-keyed source, already treated as cron/admin scoped in this repo. | Draft ECR/ADP, player IDs, player-points history, targets, news, projections, and compare-player rankings where access allows. | Actual league champions or which manager drafted which position path. | Draft-cost baseline, outcome labels, pre-draft expectation snapshots, player points backtests, and value-over-cost labels. |
| Fantasy Points "Anatomy of a League Winner" | Public article series with some premium/friction risk; cite as benchmark, not raw import. | Positional league-winner rates, round-by-round hit-rate discussion, ESPN-default methodology, and archetype framing from 2017-2024. | Raw league rows or champion draft boards. | Strategy priors for position/round hit rates and archetype labels. Good benchmark for model sanity checks. |
| CBS Sports league-winner/win-rate articles | Public article benchmark. | CBS platform win-rate signals by player, including notes on ADP and busts. | Full draft boards, manager draft sequences, or exact champion-only draft paths. | Player-level hit/miss labels and post-season model validation. |
| Yahoo champion roster articles via Bleacher Nation and similar recaps | Public article benchmark derived from Yahoo championship rosters. | Which players appeared on many championship rosters and some ADP context. | The champion's draft order, full roster path, waiver/trade acquisition source, and all league rows. | Benchmark player labels for "championship roster rate" and high-impact picks. |
| Kaggle fantasy football data 2017-2023 | Public dataset; listed as CC0 on the dataset card. | Historical ADP from Fantasy Football Calculator plus Pro Football Reference fantasy stats. | League outcomes, draft boards, champions, transactions, or format-specific roster construction. | Backtest player outcome labels, ADP value, injury/production misses, and generic draft-cost curves. |
| fflr / ffscrapr platform wrappers | Open-source wrappers around league-specific APIs for ESPN, Sleeper, MFL, Fleaflicker, etc. | Tidy draft, standings, roster, schedule, and scoring extraction when a league connection/ID is known. | Permission to discover every public league automatically, and no global outcome corpus by itself. | Optional maintenance tooling for explicitly provided league IDs, especially if we later support ESPN/MFL/Fleaflicker redraft imports. |
| Draft Fantasy API docs | Public docs for league and draft endpoints by league ID. | League-specific data and draft endpoint shape. | No public league directory or outcome corpus. | Low-priority future import path if users bring Draft Fantasy league IDs. |
| MyFantasyLeague public reports/API ecosystem | Many leagues are public by default; ffscrapr supports MFL draft/standings. | Potentially rich league-specific draft/standings/history once a league ID is known. | Need careful discovery, privacy, and terms review before broad crawling. | Research-only candidate for aggregate benchmarks if we can source explicit public league IDs safely. |
| FantasyPros Draft Wizard and competitors | Public product pages and feature benchmarks. | Feature design ideas: draft simulator, draft analyzer, draft assistant, draft intel, custom cheat sheets, salary cap tools. | Raw user draft boards/outcomes. | UX inspiration for our Draft Coach, not data ingestion. |
| ffwrapped / Sleeper league analyzer projects | Open-source/product inspiration. | Draft grades, standings, expected wins, start/sit stats, weekly reports, manager profiles, league history, and formula ideas. | Not a public multi-league outcome dataset for our product. | Feature benchmark and method inspiration for user-loaded Sleeper league analysis. |

## Import And Modeling Plan

### 1. Public Benchmark Registry

Create a small benchmark registry separate from provider snapshots:

- `source`: `fantasy_points_anatomy`, `cbs_win_rate`, `yahoo_champ_roster`, `kaggle_adp_stats`, etc.
- `season_start`, `season_end`
- `format_bucket`: `10_team_ppr_1qb`, `12_team_half_ppr_1qb`, `best_ball`, `unknown`
- `metric_type`: `position_round_hit_rate`, `champion_rostered_rate`, `player_win_rate`, `adp_outcome`, `draft_strategy_claim`
- `data_grain`: `aggregate`, `player`, `round_position`, `article_claim`, `dataset_row`
- `license_notes` and `redistribution_notes`
- `confidence`: `high`, `medium`, `directional`, or `research_only`

The registry should influence priors and admin notes, not replace our own league-outcome aggregates.

### 2. Aggregate-Only League Outcome Analyzer

Build an admin/maintenance script that takes known league IDs or discovered user-linked league IDs and outputs anonymized aggregates only:

- eligible league count by season and format bucket
- champion first pick position
- champion first two/three/four position sequence
- champion draft slot bucket
- playoff team first pick position
- top points-for first pick position
- strategy buckets: `RB-RB`, `WR-WR`, `hero RB`, `zero RB`, `elite QB early`, `late QB`, `early TE`, `punt TE`, `balanced`
- controls for league size, PPR, superflex, TE premium, kicker/DST, draft type, bench depth, and draft year

The script should discard raw league/user/player rows after counting unless an explicit app feature needs that league's own report history.

First pass command:

```bash
pnpm analyze:redraft-draft-winners --league-id <sleeper-league-id> --rounds 4
```

This first pass accepts known/shared Sleeper league IDs and prints aggregate JSON for champion/top-points draft paths. It does not write files or persist raw league/user/player rows.

Username network command:

```bash
pnpm analyze:redraft-draft-network --username <sleeper-username> --depth 2 --completed-seasons 4 --rounds 4 --out .cache/redraft-draft-outcomes/<sleeper-username>-depth2.json
```

Depth `1` scans the seed manager plus managers from the seed manager's leagues. Depth `2` also scans managers discovered from those managers' leagues. The default season set excludes the active calendar season because champion outcomes are not known yet.

The retained aggregate artifact is versioned as `redraft-draft-outcomes-v2`. It keeps model-ready counts by total, format bucket, season, and draft type. Each bucket retains champion first-pick position, first-two/first-three/full opening sequences, strategy classification, exact draft slot, early/middle/late draft-slot bucket, first-pick-by-slot counts, strategy-by-slot counts, top-points roster sequence/strategy, and whether the champion and top-points roster started with the same position. It still does not retain raw league, user, roster, or player rows.

### 3. Redraft Player Outcome Labels

Use FantasyPros/Fantasy Nerds/MFL/Fleaflicker redraft snapshots, FantasyPros player-points history, Sleeper stats, and public ADP/stat datasets to label player outcomes:

- `league_winner_pick`
- `adp_value_hit`
- `adp_reach_that_worked`
- `adp_reach_that_failed`
- `injury_miss`
- `role_miss`
- `late_round_breakout`
- `waiver_or_undrafted_winner`
- `replacement_level`

The AI readout should explain context, not just say "more players at the position." Example: if WRs drafted in Round 1 had a strong recent hit rate, it should distinguish elite target-share bets from fragile role bets.

### 4. Draft Coach UX Output

The eventual Draft Coach should show:

- current pick recommendation
- next-best pivots
- positional tier cliffs before next turn
- expected availability at next pick
- roster construction path so far
- format-specific risk note
- why the recommendation is strong or close
- benchmark evidence, such as "in similar 12-team PPR 1QB leagues, champion builds with this start most often added RB by Round 3"

## Guardrails

- Do not brute-force random league IDs.
- Do not make normal user report loads crawl public league history.
- Keep draft-outcome analysis in maintenance/admin jobs, not login/report paths.
- Store aggregate results and licensed/source-approved snapshots; avoid exporting raw third-party ranking tables or unrelated public league data.
- Keep dynasty value-history archives separate from redraft draft-outcome modeling.
- Keep redraft historical values and redraft draft strategy separate: values answer "what did the market think on draft day"; draft outcomes answer "what actually won by format."

## Useful References

- Sleeper API docs: https://docs.sleeper.com/
- FantasyPros API docs: https://api.fantasypros.com/v2/docs
- FantasyPros API access notes: https://support.fantasypros.com/hc/en-us/articles/49749297704475-How-do-I-request-access-to-the-FantasyPros-API
- Fantasy Points Anatomy of a League Winner: https://www.fantasypoints.com/nfl/articles/2025/anatomy-of-a-league-winner
- CBS Sports 2024 player win-rate article: https://www.cbssports.com/fantasy/football/news/fantasy-football-league-winner-picks-these-players-had-the-highest-win-percentage-in-2024-cbs-sports-leagues/
- Bleacher Nation Yahoo championship roster recap: https://www.bleachernation.com/fantasy-football/2024/02/09/recapping-the-2023-fantasy-football-league-winners/
- Kaggle fantasy football data 2017-2023: https://www.kaggle.com/datasets/gbolduc/fantasy-football-data-2017-2023
- fflr draft recap docs: https://rdrr.io/cran/fflr/man/draft_recap.html
- ffscrapr draft docs: https://ffscrapr.ffverse.com/reference/ff_draft.html
- Draft Fantasy CSV/API docs: https://docs.draftfantasy.com/essentials/csv
- FantasyPros Draft Wizard: https://draftwizard.fantasypros.com/football/
- ffwrapped open-source Sleeper analyzer: https://github.com/kt474/fantasy-football-wrapped
