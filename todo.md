# Dynasty Degenerates - Project TODO

- Canonical item-by-item execution prompt: [docs/todo-list-execution-prompt.md](docs/todo-list-execution-prompt.md)
- Latest one-pass execution notes: [docs/todo-execution-notes-2026-05-16.md](docs/todo-execution-notes-2026-05-16.md)

## Premium UX / Three.js Roadmap

- [x] Bring the Owner Intel / AI Tron readout grid up to the `best.png` reference quality: flowing circuit-board light paths around each tile, distinct per-card routing, cyan/orange node glow, stronger edge/corner rails, clean readable text lanes, and a full-width Dynasty AI Notes bottom rail with connected mini-modules that feels like one powered PCB system instead of separate generic cards.
- [x] Rebuild the loading and report-generated modals as true Three.js scenes, not just CSS polish. Target a premium fantasy-football command-center feel: a cinematic 3D football fly-by on a real low-to-high arc, a depth-field loading stage, a textured league-logo coin/medallion, and a physical `REPORT GENERATED` stamp slam with ripple shockwaves, subtle camera thud, light sweep, and restrained glow.
- [x] Revisit the full-screen `SuccessTakeover` report-generated modal after the mobile crash is resolved. It is temporarily removed from the live render path; before re-enabling it, consolidate it with the existing loading-dialog success card so users only see one report-generated experience, avoid `RectAreaLightUniformsLib`/`rectAreaLight` mobile failures, add a non-WebGL fallback, and verify with mobile Playwright screenshots.
- [x] Keep the experience responsive and production-safe: code-native readable text/actions, desktop/tablet/mobile framing, reduced-motion fallback, graceful non-WebGL fallback, and no blocking of report generation if the 3D scene fails.
- [x] Add visual QA coverage for the modal rebuild with Playwright screenshots and canvas checks across desktop and mobile viewports so the animation is nonblank, correctly framed, and visibly 3D before shipping.
- [ ] Evaluate a subtle Three.js command-center backdrop for the generated report shell: layered 3D field/grid depth, premium tron-line movement, light sweeps, and parallax that make the report feel alive without reducing table readability or hurting scroll performance.
- [ ] Upgrade player detail moments with restrained 3D depth where it adds signal: player/value medallion, confidence ring, market-movement pulse, and source-weight orbit that visually explains why the AI read is high or low confidence.
- [ ] Explore Three.js reveal treatments for high-value intelligence modules such as Waiver Intelligence, Trade War Room, Weekly Momentum, and Rankings: small 3D radar/scanner/market-map scenes that support the data instead of replacing it.
- [ ] Add an admin-only Three.js source-health cockpit concept for dynamic valuation trust: source nodes, drift warnings, confidence changes, and dynasty/redraft weight movement shown as an interactive 3D map for quick anomaly spotting.
- [ ] Build any Three.js expansion behind a shared lazy-loaded scene layer with strict performance budgets, feature flags, reduced-motion/static fallbacks, and mobile battery/GPU checks before enabling it broadly.

## Data Operations Roadmap

- [x] Add a Neon/Postgres transfer audit command that reports largest tables, largest JSON payload rows, recent `leagueReportCache` sizes, snapshot payload sizes, and recent source-health volume.
- [x] Run the Neon transfer audit with production `DATABASE_URL` and record the main transfer drivers.
- [x] Add transparent compression for large `leagueReportCache` payloads and a one-off compaction command for existing heavy cache rows.
- [x] After the compaction command runs against production, re-run `pnpm audit:neon-transfer` and confirm the 18 MB `league-rankings-v11` rows are reduced.
- [x] Add a dry-run stale `leagueReportCache` cleanup command that keeps current report/rankings cache versions, prints only row metadata and payload size, and requires explicit confirmation before deletion.
- [x] Run `pnpm cleanup:league-report-cache` against production, review the stale cache rows, and delete approved stale cache rows.
- [x] Run one-off source-health history backfill with `ENABLE_SOURCE_HEALTH_BACKFILL=true` after production cached reports exist; production scan found no eligible cached-report diagnostics to backfill.
- [x] Add and run an expired `leagueReportCache` cleanup mode for rows older than the serving TTL.
- [x] Align browser report cache with the server cache and avoid the extra `league.rankings` request when the loaded report already includes rankings.
- [x] Switch interactive value/ranking generation to latest stored source snapshots so normal report/ranking/rank lookup loads do not call KTC, FantasyCalc, DynastyProcess, Flock, DynastyNerds, FantasyNerds, FantasyPros dynasty/devy, or redraft ranking providers.
- [x] Move remaining non-Sleeper report enrichments to provider snapshots: FantasyPros news, ESPN depth charts, and DraftSharks/SOS now refresh through dynamic-data jobs and read stored snapshots during user-triggered report/player-detail loads.
- [x] Move static Sleeper season stats and historical availability reads to persisted nightly snapshots so normal report loads only live-check current league state, transactions, drafts, trends, matchups, and player index changes.
- [x] Add a user-load provider boundary guard: report/ranking/player-detail loads use live Sleeper current-state calls only, non-Sleeper reads share snapshot-mode options, and tests block accidental live FantasyPros/OpticOdds/etc. calls during user loads.
- [x] Add scoped provider telemetry for the user-load boundary so admin diagnostics separate sanitized Sleeper user-load calls from cron/admin provider refreshes without logging raw payloads, tokens, or league IDs.
- [x] Add source freshness diagnostics for every snapshot-backed provider in the admin/report payload: source key, snapshot key, updated time, row count, payload size, stale/missing status, and last job error where available.
- [x] Add report-payload auditing and transfer slimming for cached league reports: local cache payloads can be measured by section, duplicate embedded `playerDetails` are compacted when `playerDetailsById` already carries that player, and cache metadata can be checked without reading full payloads.
- [x] Reduce rankings transfer by dropping duplicate legacy ranking arrays from transfer/cache payloads and compacting repeated prospect profile details in ranking rows while preserving full prospect detail through the Draft Buzz scoreboard copy.
- [x] Reduce transfer further with ranking metadata/detail endpoints: normal rankings loads now fetch metadata first, then load only the active ranking profile or prospect archive detail when the UI opens it.
- [x] Reduce transfer further with tighter cache TTL/retention and expanded metadata-only cache/status reads: report-cache TTL is configurable, local file-cache fallbacks prune expired/overflow entries, expired cleanup follows the serving TTL by default, and `league.reportCacheStatus` reads freshness metadata without hydrating full payloads.
- [x] Split generated report inputs into Sleeper-current-state and snapshot-backed static sections: `league.analyze` still refreshes live Sleeper league/users/rosters/transactions/drafts/trends/matchups, while cached static inputs reuse nightly-backed values, weekly baselines, FantasyPros news, DraftSharks/SOS, and prospect context.
- [x] Split generated report output sections further so fully static rendered sections can be reused across login refreshes, while mixed sections recompose from fresh Sleeper state plus cached static inputs. First pass caches all-player schedule profiles and source-freshness diagnostics while roster, transaction, waiver, matchup, draft, and standings sections still rebuild from live Sleeper reads.
- [x] Add a report hotspot audit command so the next output-cache split is evidence-based: `pnpm audit:report-hotspots` ranks cached report sections by payload size, nested field-size hotspots, item counts, section class, and optional `league.analyze` timing-log aggregates without printing payload values.
- [x] Split `playerDetailsById` static enrichment into a cache keyed by value profile, season window, and player-set signature: live base player details still come from fresh Sleeper player index plus `rosterStatusByPlayerId`, while cached enrichment overlays value profile, prospect profile, availability/history, latest news, schedule, league usage, and similar-trade values.
- [x] Continue splitting report output caches by section after measuring payload and compute hotspots: recursive transfer/cache slimming now has explicit regression coverage for nested player arrays inside `managerRosterIntelligence`, `managerPositionCounts`, `draftPicks`, and trade-table-like rows so those sections keep using `playerDetailsById` as the canonical full-detail source.
- [x] Confirm production rights/terms for FantasyPros before treating it as a primary paid/API data source.
- [x] Keep Fantrax out of the blend until we confirm a stable API or approved integration path.
- [x] Revisit KeepTradeCut trade-database access later; only integrate it if we can get a stable, approved data path instead of a brittle scrape.
- [x] Confirm whether DraftSharks partner REST API/docs require a partner login or API key, and whether access is only available through their affiliate/control-panel workflow.
- [x] Add an approved-access DraftSharks SOS integration shell behind server-only feature flags without scraping public DraftSharks pages.
- [x] On May 14, 2026, run the projections/SOS rollout checklist below before wiring any schedule-dependent feature to live data: current implementation keeps the approved schedule path to Sleeper current-state plus stored NFL bye-week/DraftSharks SOS snapshots, with projection-driven features still blocked until rights/freshness are validated.
- [ ] Configure `SOURCE_HEALTH_ALERT_WEBHOOK_URL` for Slack/email/webhook alert delivery in production.
- [ ] Calibrate player value confidence thresholds after enough 2026 source snapshots, trades, waivers, and injury/news events accumulate.
- [x] Document a single-key leak response plan for API providers that will not rotate/reissue keys, including immediate disable steps, deploy rollback steps, and local/prod secret audit steps.
- [x] Add backend API provider telemetry foundation showing call volume, failures, 429s, cache hit rate, and highest-cost jobs by provider.
- [x] Add an admin-only API budget and rate-limit dashboard UI backed by provider telemetry.
- [x] Add a new-source probation rule: every new API/feed starts at low effective weight until it has enough stable snapshots, healthy row counts, and acceptable source-consensus drift.
- [x] Add snapshot replay/regression tests that run old stored snapshots through current blend logic and flag unexpected value, rank, or source-weight changes.

## Monetization / Auth Roadmap

- [x] Keep the public funnel low-friction: allow unauthenticated users to run a limited free Sleeper report before asking them to create an account.
- [x] Define the first pricing model before building billing gates: Free, Pro, League Pass, and Elite tiers.
- [ ] Add passwordless email magic-link auth for normal users, reusing the existing first-party `users` table and session-cookie flow instead of introducing password storage.
- [ ] Add a transactional email provider for magic links, billing notifications, and later alert delivery; keep provider keys server-side only.
- [ ] Add account-linking support so a signed-in user can save Sleeper usernames, favorite leagues, recent reports, and notification preferences.
- [ ] Add Stripe checkout for individual subscriptions, league passes, and one-time seasonal products such as a rookie draft kit or redraft draft kit.
- [ ] Add Stripe customer portal support so users can self-serve payment updates, cancellations, and plan changes.
- [ ] Add Stripe webhook handling for subscription created, updated, canceled, payment failed, and one-time purchase completed events.
- [ ] Add billing and entitlement tables for `billingCustomers`, `subscriptions`, `leaguePasses`, `featureEntitlements`, and `usageEvents`.
- [ ] Enforce paid access on the backend with a shared entitlement helper such as `canUseFeature(user, feature, leagueId)`; frontend paywalls should only be UX hints.
- [ ] Add usage limits by tier, including reports per day, saved leagues, saved reports, alert count, export access, and source-trace visibility.
- [ ] Gate high-cost or high-value features first: unlimited reports, multi-league portfolio, AI confidence history, source trace details, anomaly alerts, exports, and draft kit tools.
- [ ] Build a League Pass model where one purchaser can unlock a specific league for all managers or invited league members.
- [ ] Add paid-feature telemetry for conversion, trial-to-paid movement, active subscribers, MRR, churn, failed payments, report usage, and upgrade prompt performance.
- [ ] Add an admin billing board for active plans, failed payments, entitlement overrides, revenue metrics, and suspicious usage.
- [ ] Add legal/compliance pages before charging: Terms, Privacy Policy, Refund/Cancellation Policy, and data-source disclosures.
- [x] Do not use personal/non-commercial API keys inside paid/public feature outputs unless we have provider approval or a commercial license for that source.
- [ ] Add tests for auth token expiry, magic-link replay protection, webhook signature verification, entitlement checks, usage limits, and paid/free report boundaries.

## Source Audit / Feature Roadmap

- [x] Audit every live API, partner feed, and scrape we use today, including Sleeper, FantasyPros, DraftSharks, KeepTradeCut, Flock Fantasy, FantasyCalc, Dynasty Nerds, Fantasy Nerds, DynastyProcess, Prospect Archive / NFL Draft Buzz, ESPN prospect metadata, and any internal snapshot jobs.
- [x] For each source, document exactly what comes back: endpoint or URL, auth model, rate limits, payload shape, unique IDs, timestamps/freshness, row counts, and known gaps or failure modes.
- [x] Write down which features each source can power now vs later so we can spot unused data before adding more integrations.
- [x] Save a compact sample payload or field map per source so the team can compare feeds without needing a fresh live fetch.
- [x] Turn that audit into a source coverage matrix in admin so we can see at a glance what each API or scrape is actually returning.
- [x] Use this compact template for each source during the audit: `Source / Returns / Used now / Could power later / Open questions`.
- [x] Sleeper - Returns: league settings, rosters, players, matchups, waivers, trades, news/status, and user/player IDs. Used now: league analysis, roster intelligence, matchup preview plumbing, waiver/trade analysis, and identity matching. Could power later: schedule-week matchup reads, exposure views, alerting, and lineup guidance. Open questions: which endpoints reliably expose current-week matchup and projection context.
- [x] Research the Google query `api to get nfl player nicknames` and compare the useful fields from the results against the NFL APIs we already consider first-class so we can capture any extra nickname/alias data we are missing.
- [x] For each candidate result from that query, document whether it provides player nicknames, alternate display names, alias mappings, pronunciation hints, suffix normalization, social handles, or other identity-enrichment fields beyond our current data.
- [x] Cross-check the nickname/alias sources against the APIs already on our recommended list, including Sleeper, BALLDONTLIE, nflreadr/nflverse player-name mappings, SportsBlaze, FantasyData/SportsDataIO, Sportradar, ESPN, and any other vetted NFL endpoints.
- [x] Decide which extra fields are actually worth storing or normalizing in our player identity layer, and which ones are only nice-to-have research artifacts.
- [x] FantasyPros - Returns: rankings, projections, ADP, injuries, news, compare-players, player-points, and player/external IDs. Used now: dynasty/redraft blends, rookie and devy context, injury/news notes, player modal details, and confidence calibration. Could power later: lineup strength, value movement, matchup preview, and trade explainers. Open questions: rate limits, production terms, and which projection/news endpoints are safe to depend on.
- [x] DraftSharks - Returns: rankings, SOS, bye weeks, D/ST, matchup data, and possibly projections. Used now: source research only. Could power later: bye-week navigation, streamer planning, matchup reads, and schedule-strength tooling. Open questions: partner/API access and whether the public pages stay stable enough to trust.
- [x] DraftSharks SOS shell - Returns: approved partner REST team/position SOS rows when configured. Used now: gated backend schedule enrichment only. Could power later: streamer weeks, avoid weeks, schedule tiers, matchup reads, and D/ST planning. Open questions: final partner URL, payload shape, and production terms from DraftSharks control panel.
- [x] KeepTradeCut - Returns: trade-database rows, market values, and source metadata where available. Used now: trade/value research. Could power later: dynasty trade comps and market trend views. Open questions: whether access is stable without scraping and whether there is a supported data path.
- [x] Flock Fantasy - Returns: exposure counts, league-share data, and player ranking rows. Used now: dynasty/rookie source research. Could power later: portfolio exposure and roster concentration. Open questions: whether the exposure feed is stable enough to ingest.
- [x] FantasyCalc - Returns: dynasty/redraft value rows and source metadata. Used now: blended-value inputs and confidence support. Could power later: value trend and comparison views. Open questions: refresh cadence and source coverage details.
- [x] Dynasty Nerds - Returns: dynasty, rookie, and format-specific ranking rows. Used now: dynasty and rookie blending. Could power later: format-specific rookie draft reads. Open questions: coverage by format and source freshness.
- [x] Fantasy Nerds - Returns: rankings, projections, or diagnostic rows if available. Used now: source-coverage checks. Could power later: redraft projections and validation. Open questions: which endpoints are current and supported.
- [x] DynastyProcess - Returns: calculator outputs, dynasty values, and trade context. Used now: dynasty value blending. Could power later: trade comparison and roster value explanation. Open questions: which calculator outputs are stable and current.
- [x] Prospect Archive / NFL Draft Buzz - Returns: prospect rankings, scouting notes, draft year, college, team, and image/logo fields. Used now: devy and rookie prospect handling. Could power later: scouting detail cards and prospect comparison. Open questions: source freshness and image/logo consistency.
- [x] ESPN prospect metadata - Returns: player/team/college/external ID fields. Used now: cross-source identity matching. Could power later: better prospect/player normalization. Open questions: which IDs are reliable enough to treat as canonical.
- [x] Internal snapshots/jobs - Returns: historical values, source-health events, league snapshots, and draft records. Used now: trend analysis, backfills, diagnostics, and confidence calibration. Could power later: anomaly detection and source-history dashboards. Open questions: which historical jobs still need backfill or retention tuning.
- [x] Yahoo Fantasy - Official API exists for fantasy football league/team/player/matchup data through OAuth and application approval. Research whether it returns rankings, projected points, percent-started, roster trends, or only league-scoped fantasy data; if integrated, keep it as an opt-in platform connector and nightly snapshot source, not a normal report-load dependency. Probe script: `pnpm run probe:external-sources` checks the OAuth-gated API surface without printing payloads or credentials.
- [x] Fantrax - Investigate whether Fantrax has an approved API/partner path for football rankings, ADP, ownership, projections, or public league data. Current public docs are unofficial bindings, so do not scrape or authenticate with user cookies unless Fantrax approves a supported integration. Probe script checks only public docs and unauthenticated reachability.
- [x] FFPC - Research official/approved access for contest ADP, tournament ownership, draft boards, and high-stakes rankings. Treat as high-value market signal if licensed, but do not scrape pay-to-play contest data. Probe script checks the exposed API help page and a lightweight documented projected-points route.
- [x] Player props / betting lines - Research approved odds/props APIs for Underdog, bet365, Sleeper Picks, PrizePicks, FanDuel, DraftKings, Pinnacle, and aggregator APIs. Use only licensed feeds, snapshot props in cron jobs, and convert them into start/sit, projection-confidence, injury-risk, and market-implied role signals. Probe script checks OpticOdds, SportsGameOdds, ParlayAPI, and public docs for Sleeper/Underdog/bet365 coverage.
- [x] Add player prop snapshot foundation with normalized prop lines, OpticOdds env-gated refresh, provider snapshot persistence, and fixture tests. Keep props provider calls in dynamic-data refresh only; normal report loads should read stored snapshots.
- [x] Add prop-market signal model shell that reads stored prop snapshots only, compares market lines to internal projection inputs, and emits sportsbook agreement, confidence, direction, and neutral start/sit support flags.
- [x] Feed stored prop-market signals into backend manager market reads so report/autopilot intelligence can use props as value/start-sit context without live provider calls.
- [ ] After OpticOdds approves/issues an API key, configure `ENABLE_OPTICODDS_PLAYER_PROPS=true` and `OPTICODDS_API_KEY` only in server/prod env, then run dynamic-data refresh and audit stored `player-props-opticodds-v1` row count, payload size, sportsbook coverage, and market coverage without printing payloads or secrets.
- [ ] After the first real props snapshot, tune `OPTICODDS_SPORTSBOOKS` and `OPTICODDS_PROP_MARKETS` around available NFL markets for Sleeper, Underdog, bet365, and major books, then add source-health/freshness diagnostics before surfacing props publicly.
- [x] Add compliance and responsible-gaming boundaries before public props UI; internal report intelligence can use generic market-signal language first.
- [ ] Tune prop-market signal thresholds after real snapshots exist: compare player props against projection/value snapshots, calibrate meaningful deltas for start/sit decisions, matchup previews, and player confidence, then document jurisdiction/compliance and responsible-gaming boundaries before public release.
- [x] Add a shortlist of features we already have enough data to build from current sources:
  - [x] News-to-value movement analysis using FantasyPros/Sleeper news, injury, and snapshot timing.
  - [x] ADP vs value-over-cost views using FantasyPros ADP / DYNADP / RKADP plus current value blends.
  - [x] Rookie and devy prospect comparison views using the existing prospect and ranking sources.
  - [x] Cross-league exposure, concentration, and roster-share reporting from stored league snapshots.
  - [x] Waiver and trade calibration dashboards from historical outcomes and manager-league history.
  - [x] Player source trace views that show which feeds are contributing to a player's current value or confidence.

## AI Logic / Signal Engineering Roadmap

- [ ] Build a historical player cohort engine that compares value, production, age, draft capital, and role across all players by position, format, and season.
- [x] Add age/value curves so AI can tell whether a player is early, normal, or late relative to their position's typical peak and decline window.
- [ ] Measure production peaks and decline slopes by season, age, and game window so the readouts can flag when a player has already peaked, is peaking now, or is still climbing.
- [x] Add a first snapshot-backed nflverse usage trend layer for targets, carries, receptions, PPR production, target share, and offense snap percentage so player/cohort reads can identify role growth or decline without live report-load calls.
- [x] Add nflverse combine and contract context snapshots so player AI reads can distinguish size/speed archetypes and veteran investment runway from pure market value.
- [ ] Expand breakout and falloff detection into full year-over-year changes in snap share, targets, rush attempts, routes, touchdowns, and efficiency after route participation is available from an approved/stable source.
- [x] Build first-pass player archetype inputs using size, athletic profile, draft capital, contract investment, usage profile, and scoring shape so the AI can explain similar historical outcomes instead of just raw ranks.
- [ ] Add rolling trend, volatility, and momentum features across 3/6/12/24 game and season windows so the readouts distinguish sustained growth from short spikes.
- [ ] Separate opportunity-driven value from talent-driven value by modeling team context, depth-chart changes, injuries, QB changes, offensive environment, and role shifts.
- [x] Build the all-player Player Situation Delta engine from stored public snapshots so rookies, sophomores, veterans on new teams, and veterans whose teams changed around them get role/opportunity reads instead of rookie-only context. See `docs/player-situation-delta-data-plan.md`.
- [x] Migrate the nflverse usage snapshot from the legacy combined `player_stats.csv` source to season-specific `stats_player` releases so current target share, air-yard share, WOPR, carries, targets, and fantasy production stay fresh.
- [x] Add team-environment snapshots from nflverse `stats_team` and `pbp` so AI reads can account for team pass rate, rush rate, neutral-script pass rate, red-zone tendency, non-garbage pass rate, estimated pace, target volume, play volume, and offensive tendency without live report-load calls.
- [x] Add first-pass roster-room delta snapshots from nflverse rosters and depth charts so reads can identify same-position additions, losses, rookie/premium additions, crowded rooms, and vacated opportunity.
- [x] Expand roster-room deltas with weekly rosters and transaction typing so additions/losses can distinguish draft picks, inferred free-agent/claim movement, trades, injury returns, practice-squad churn, and offseason/camp noise.
- [x] Quality-weight roster movement with prior-season targets, carries, receptions, PPR production, target share, WOPR, movement impact score, net opportunity score, and incumbent promotion score so JSN-style breakout windows account for whether added/lost players were actually meaningful.
- [ ] Add a broader official transaction source so roster-room deltas can stop inferring non-trade movement and can explicitly classify free-agent signings, releases, waiver claims, reserve-list moves, and exact signing dates.
- [ ] Add public advanced-efficiency snapshots from nflverse Next Gen Stats, PFR advanced stats, FTN charting, and participation/personnel data while explicitly labeling any route-derived public signal as estimated.
- [ ] Add a curated coach/offensive coordinator/play-caller snapshot with source URLs, verified dates, prior roles, and confidence flags so scheme-change reads can account for new coaching staffs without relying on stale memory.
- [ ] Keep exact routes run, route share, targets per route run, and yards per route run gated until an approved licensed source provides route-volume data; use target share, air-yard share, WOPR, NGS, PFR advanced, and estimated route participation as public-data fallbacks.
- [x] Add age-adjusted market-vs-production deltas so we can spot players whose market value is lagging or overstating what the production curve says.
- [x] Build position-specific aging models for QB, RB, WR, and TE, since the same age means different things by position and role.
- [x] Add snapshot-backed injury-history context from nflverse injury reports so player reads can separate clean availability from recurring limited/out-style report signals.
- [ ] Add deeper historical outcome buckets such as breakout, sustain, fade, injury-cliff, and late-career rebound, then map current players into those buckets for AI reads.
- [x] Add a first-pass player cohort signal engine with position age phases, market-vs-production deltas, current outcome buckets, confidence gating, same-position peer rows, and explanation traces without adding provider calls.
- [ ] Backtest every new heuristic against historical seasons to measure false positives, false negatives, and calibration drift before exposing it in readouts.
- [x] Surface a short explanation trace in the UI so each player AI read can show the top reasons the model thinks a player is undervalued, overvalued, peaking, or declining, including draft-capital runway so high picks and late/undrafted profiles are judged with different opportunity patience.
- [x] Add confidence gating so thin, noisy, or conflicting signals reduce certainty instead of forcing a strong read.
- [x] Add player-cohort calibration metadata so every player AI read carries an evidence grade, confidence cap, strong-read eligibility flag, missing-signal list, and caution flags before the UI can present it as a high-confidence take.
- [ ] Add league-context modifiers for dynasty, redraft, superflex, and format-specific scoring so the logic stays format-aware.
- [ ] Create anomaly rules for unusual cases like age-curve outliers, late breakouts, injury comebacks, small-sample spikes, and role-driven production jumps.
- [ ] Build a reusable comparison layer that can answer "who has this player most resembled historically at the same age, usage, and value?" for deeper AI readouts.
- [x] Expand the source-history layer with compact nflverse usage, injury, combine, and contract snapshots stored in `providerDataSnapshots`.
- [x] Add admin diagnostics/freshness coverage for nflverse usage, injury, combine, and contract snapshots so model inputs are visible without raw payloads.

## Overview Tab / Readout Clarity Roadmap

- [x] Audit every table in the Overview tab and list the exact job each one is supposed to do.
- [x] Add cross-tab AI readout feature coverage checklist: see `docs/ai-readout-feature-coverage.md`.
- [x] Identify any repeated signals, summaries, or conclusions that are being shown on multiple tables and document the duplication ownership risk.
- [x] Remove the duplicated Overview readouts from the UI surfaces after the ownership mapping is applied.
- [x] Define one primary message for each table so we can clearly decide what belongs there and what should live elsewhere.
- [x] Move overlapping readouts into the table that owns them, or pull them out entirely if they do not have a clear owner.
- [x] Make sure the Overview tab reads as a set of distinct layers of insight instead of multiple tables saying the same thing in different words.
- [x] Add review pass for each Overview table after logic changes so duplicates do not creep back in during future feature work.
- [x] Build an ownership matrix for every Overview surface with columns for surface, primary job, allowed readouts, banned overlap, and source-of-truth owner.
- [x] Audit the full Overview stack in render order and assign one job to each surface:
  - [x] `OverviewAIPulse`: narrative summary only; it should set the league story, not repeat table metrics.
  - [x] `Monthly Team Blueprint`: long-horizon roster plan only; keep it focused on team direction, age curve, and roster construction.
  - [x] `League Power Rankings`: league-wide strength/value ordering only; do not duplicate owner-level advice or roster-blueprint language.
  - [x] `Team Breakdown & Roster Recon`: strengths, leaks, surplus, and next move only; it should explain the roster, not re-rank the league.
  - [x] `Trade Finder, Partners & League Exploits`: trade opportunities, partner matching, and league pressure points only; do not repeat roster-health or power-rank copy.
  - [x] `Assistant Feature Radar`: placeholder/shell inventory only; it should never echo active analysis from the real readouts.
  - [x] `OwnerIntelMatrix`: owner identity, roster identity, comp lanes, and strategy tags only; keep it as the owner-level source of truth.
  - [x] `LeagueCommandCenter` in roster mode: projected starters, bench depth, step-ins, season read, and injury insurance only.
  - [x] `LeagueCommandCenter` in taxi mode: taxi promote/park/cut decisions only.
  - [x] `Manager Position Counts`: position depth and imbalance only; keep it as the single owner for count-based roster gaps.
- [x] Define the duplicated concepts that must have one clear owner and no copy-paste repetition:
  - [x] league value rank
  - [x] starter count / starter room
  - [x] bench depth
  - [x] age and age flags
  - [x] roster health
  - [x] position imbalance
  - [x] tradeable depth
  - [x] trade partner fit
  - [x] taxi promote/park/cut calls
  - [x] top-manager or best-team claims
- [x] If a concept has to appear in two places, rewrite one instance so it clearly answers a different question instead of repeating the same conclusion.
- [x] Move shared calculations into one source of truth and make the other surfaces reference that result rather than restating the same readout.
- [x] Compare the final Overview stack side-by-side after every logic change and remove any repeated phrasing, repeated ranks, repeated value tags, or repeated "best/worst" labels.
- [x] Add a regression check or snapshot test that fails if two Overview surfaces end up telling the same story with the same metric stack.
- [x] Require an explicit owner review for any new Overview metric so we do not reintroduce duplicate readouts when new features land.
- [x] Enforce the ownership matrix in rendered Overview copy: Power Rankings stays league-ordering only, Team Breakdown stops naming trade chips/sell candidates, and Trade Finder owns specific trade packages/targets.

## May 14, 2026 - Projections / SOS Rollout

- [x] Confirm the approved source blend for projections, strength of schedule, and bye-week data before wiring any feature to live inputs: see `docs/projections-sos-source-policy.md`.
- [x] Compare DraftSharks and FantasyPros as the long-term rankings/SOS source blend before raising trust weights for either one after approved DraftSharks access is configured: DraftSharks is the preferred approved-access SOS source; FantasyPros projections remain blocked for production use until commercial terms/rate limits are approved.
- [x] Populate `schedulePlanning` from the schedule-release data so roster gaps, streamer candidates, and bye-window coverage have real source-backed inputs.
- [x] Wire schedule-aware inputs into matchup preview so weekly win odds, opponent edge, and "how you win" reads can use projection and SOS context.
- [x] Wire schedule-aware inputs into player detail views so bye windows, SOS tiers, and schedule summaries are visible at the player level.
- [x] Wire schedule-aware inputs into weekly autopilot planning so streamer suggestions, roster gaps, and priority actions reflect byes and SOS.
- [x] Wire schedule-aware inputs into D/ST and matchup-streamer logic so upcoming schedule strength can influence start/sit and pickup decisions.
- [ ] Wire projections into lineup-strength, redraft valuation, and confidence calculations only after validating source freshness and endpoint stability.
- [x] Add source-health checks and freshness checks for every projection/SOS feed we plan to depend on: report diagnostics now include DraftSharks SOS, player props, redraft source snapshots, FantasyPros health rows, and stored provider snapshot freshness; projection-driven rollout remains blocked until approved projection snapshots exist.
- [x] Add tests for schedule normalization, bye-window rendering, streamer candidate generation, DraftSharks SOS normalization, and planner output from real schedule inputs.
- [x] Leave a clear fallback state for pre-schedule and missing-data periods so offseason views remain stable.

## Future Full NFL Schedule + Player Projection Roadmap

### Source Access And Policy Gates

- [ ] Confirm the approved full NFL schedule source before using it in production: prefer an official or licensed endpoint that returns season, week, game date/time, home team, away team, venue, neutral-site flag, game status, and source update timestamp.
- [ ] Confirm the approved weekly player projection source before using projections in public reports: FantasyPros, DraftSharks, SportsDataIO, Fantasy Nerds, or another licensed provider is acceptable only after production terms, rate limits, redistribution rules, and freshness guarantees are documented.
- [ ] Keep normal user-triggered report loads snapshot-backed for full schedule and projection data; live calls during login/report generation should remain limited to Sleeper current league state.
- [ ] Add feature flags for each projection source and projection type: weekly, rest-of-season, preseason, playoff weeks, position-specific projections, team defense projections, kicker projections, and injury-adjusted projections.
- [ ] Add source policy docs for projection display language so the UI never labels internal estimates as provider projections and never implies unavailable provider data is present.
- [ ] Add rollout kill switches so bad projection snapshots, stale schedules, or broken source mappings can disable projection-influenced reads without breaking base reports.

### Full NFL Schedule Snapshot Layer

- [ ] Add a normalized `nflScheduleGames` snapshot model keyed by `season`, `week`, `gameId`, `homeTeam`, `awayTeam`, `startsAt`, `gameStatus`, and `sourceVersion`.
- [ ] Store schedule metadata with `source`, `sourceUrl` or provider key, `fetchedAt`, `publishedAt`, `seasonType`, `rowCount`, `checksum`, and parser version.
- [ ] Normalize team codes across Sleeper, provider schedule feeds, FantasyPros, DraftSharks, ESPN, SportsDataIO, and internal abbreviations so `JAC/JAX`, `ARI/ARZ`, `LA/LAR/LAC`, and Washington naming drift do not break joins.
- [ ] Capture home/away, short-rest, long-rest, travel distance bucket, dome/outdoor, weather-sensitive stadium, international game, neutral site, division game, conference game, and projected playoff-week relevance.
- [ ] Add schedule versioning so corrections, flex scheduling, postponed games, and kickoff changes can be audited without mutating historical reads silently.
- [ ] Add diagnostics that compare the stored schedule against Sleeper matchup weeks and provider projection weeks so mismatched season/week boundaries are visible before projections are trusted.
- [ ] Add fallback behavior for missing game rows: keep bye-week planning, neutral SOS, and internal value reads available while clearly suppressing projection-specific claims.

### Player Projection Snapshot Layer

- [ ] Add a normalized `playerProjectionSnapshots` model keyed by `season`, `week`, `playerId`, `source`, `scoringProfile`, `projectionType`, and `sourceVersion`.
- [ ] Store core projection fields: projected fantasy points, passing/rushing/receiving volume, touchdowns, receptions, targets, carries, routes if available, snaps if available, turnovers, field-goal attempts, defensive stats, and confidence or expert-count metadata when provided.
- [ ] Store source freshness fields: `fetchedAt`, `publishedAt`, `validForWeek`, `providerUpdatedAt`, `rowCount`, `positionCoverage`, `missingStarterCount`, `sourceError`, and `staleReason`.
- [ ] Support scoring-specific projections for PPR, half-PPR, standard, superflex, TE premium, six-point passing touchdown, and custom league settings where provider data supports it.
- [ ] Add projection history retention so weekly projection accuracy, source bias, stale reads, and positional calibration can be measured after games complete.
- [ ] Add player identity mapping diagnostics for every projected row: Sleeper player ID, provider player ID, full name, team, position, status, rookie flag, and confidence score.
- [ ] Add a quarantine path for ambiguous player matches, retired players, duplicate names, team changes, practice-squad players, and rookies without stable provider IDs.

### Schedule + Projection Join Model

- [ ] Build a projection context join that links `playerProjectionSnapshots` to the full NFL schedule by player team, week, opponent, home/away, bye status, and game environment.
- [ ] Add opponent defensive context once approved data exists: positional fantasy points allowed, pace, pass/rush funnel, pressure rate, explosive-play allowance, red-zone weakness, and D/ST turnover/sack opportunity.
- [ ] Add weather and game environment hooks for late-week updates: wind, precipitation, temperature, dome/outdoor, Vegas total if licensed, implied team total if licensed, and postponement risk.
- [ ] Add team depth-chart context so projections can be weighted by role stability, injury replacements, starter status, backup pressure, and snap-share trend.
- [ ] Add draft-capital and contract-context opportunity weighting so early NFL draft picks, premium rookie picks, and highly paid veterans are understood as likely to get longer opportunity runways than fringe players with similar short-term production.
- [ ] Add rookie ramp and opportunity-patience rules by draft round, position, team investment, camp role, depth-chart opening, and historical team behavior so AI reads do not overreact to one quiet early game.
- [ ] Add projection-to-value bridge fields that separate dynasty value, redraft weekly projection, rest-of-season projection, long-term role security, and opportunity runway.
- [ ] Add explainability traces that show which projection, schedule, opponent, injury, draft-capital, and role signals changed a player read.

### Product Surfaces To Upgrade

- [ ] Upgrade matchup previews from internal schedule/value estimates to source-backed projected points once projection snapshots pass freshness gates.
- [ ] Add lineup-strength reads that compare current starters, optimal starters, bench alternatives, opponent starters, positional edges, floor/ceiling gap, and projected win probability.
- [ ] Add start/sit recommendations that explain projection edge, schedule edge, floor/ceiling, injury risk, draft-capital patience, and when the recommendation is too close to call.
- [ ] Add redraft valuation support that blends weekly projection, rest-of-season projection, role trend, injury/news status, schedule stretch, bye timing, and replacement-level availability.
- [ ] Add dynasty contention context that separates "start now", "hold through development", "sell on projection spike", "buy before role growth", and "do not panic because draft capital buys runway".
- [ ] Add rookie and sophomore development reads that explicitly account for draft position, NFL team investment, early usage, depth-chart barriers, and how long similar players usually get opportunities.
- [ ] Add waiver-wire priority changes based on upcoming schedule, projected usage, bye coverage, injury fill-in windows, and whether the role has multi-week staying power.
- [ ] Add trade recommendation context that distinguishes projected short-term points from dynasty value, playoff schedule leverage, contender/rebuilder fit, and fragile projection spikes.
- [ ] Add Autopilot actions that can say exactly why to start, bench, claim, stash, trade for, trade away, or hold a player based on the joined schedule/projection context.
- [ ] Add player-detail projection cards for weekly outlook, ROS outlook, schedule stretch, opponent notes, role security, draft-capital runway, confidence, and source freshness.
- [ ] Add Overview badges or notes only when projection/schedule context changes the conclusion; avoid duplicating the same read across matchup, roster, and owner tables.
- [ ] Add playoff-week views for contenders: Weeks 15-17 projected lineup strength, opponent difficulty, bye/bench pressure, handcuff value, and stash recommendations.
- [ ] Add D/ST streamer and kicker streamer projection support only if the source coverage is stable enough; otherwise keep those reads schedule/SOS based.

### AI Readout Rules

- [ ] Teach AI readouts to distinguish provider projections, internal projections, schedule estimates, market-implied signals, and dynasty values in plain language.
- [ ] Add confidence language that drops when projection snapshots are stale, player identity is uncertain, injury status is unresolved, or source coverage is thin.
- [ ] Add "opportunity runway" explanations for rookies, high-draft-capital players, and expensive veterans so recommendations account for how long a team is likely to keep giving chances.
- [ ] Add guardrails against overreacting to one-week projection swings when draft capital, contract, role, and long-term value all point the other way.
- [ ] Add guardrails against blindly trusting draft capital when projection decline, usage collapse, depth-chart loss, or injury recurrence shows the opportunity window may be closing.
- [ ] Add source trace text that can answer "why did the AI say this?" with the exact schedule week, opponent, projection source, projection timestamp, and biggest changing signals.
- [ ] Add fallback copy for missing projections that says the app is using schedule/value context only, not true weekly projections.

### Admin Tooling, QA, And Observability

- [ ] Add admin diagnostics for schedule snapshot health: current season/week coverage, games per week, missing teams, bye weeks, source timestamp, checksum changes, and parser warnings.
- [ ] Add admin diagnostics for projection snapshot health: player coverage by position/team/source, stale rows, missing starters, duplicate identities, scoring-profile gaps, and source error rates.
- [ ] Add admin diff tooling that compares two projection snapshots and highlights the biggest player moves, team-level shifts, injury-driven changes, and suspicious provider swings.
- [ ] Add source accuracy backtests after games finish: projected vs actual by source, position, week, home/away, opponent strength, rookie status, and draft-capital bucket.
- [ ] Add regression tests for schedule parsing, team-code normalization, projection normalization, identity matching, scoring conversion, stale-source fallback, and user-load provider guards.
- [ ] Add Playwright coverage for Overview, Matchup Preview, Player Detail, Autopilot, Rankings, waiver, trade, and playoff schedule surfaces with projection-enabled and projection-disabled states.
- [ ] Add data seeding fixtures for one normal week, one bye-heavy week, one injury-heavy week, one rookies-heavy roster, and one playoff matchup week.
- [ ] Add performance budgets so projection joins do not slow report generation; prefer precomputed static sections and cached projection contexts over per-user recomputation.
- [ ] Add cache-version bumps when projection or schedule display semantics change so users do not see stale local report cards.

### Release Gates

- [ ] Do not enable projection-driven lineup strength until the schedule snapshot, projection snapshot, source freshness metadata, identity matching, and fallback copy all pass diagnostics.
- [ ] Do not enable projection-driven trade or dynasty recommendations until the AI readout can separate short-term projection movement from long-term dynasty value and draft-capital runway.
- [ ] Do not enable projection-driven push/email/watch alerts until stale-source handling, opt-out controls, and alert-rate limits are in place.
- [ ] Do not show provider names in public-facing projection claims unless the source agreement allows user-facing attribution.
- [ ] Ship first to admin-only traces, then internal leagues, then a limited production flag, then general availability after two or more clean weekly refresh cycles.

## FantasyPros Integration Roadmap

- [x] Store the FantasyPros key only in server env as `FANTASYPROS_API_KEY`, keep it out of source control/client bundles/logs, and document the production deployment step.
- [x] Confirm FantasyPros production terms, rate limits, and non-commercial restrictions before making it a primary valuation source.
- [x] Add source-health checks for every FantasyPros endpoint we plan to depend on, including row counts, last updated date, expert count, and rate-limit/error status.
- [x] Add separate feature flags for FantasyPros sub-sources so `DRAFT`, `ROS`, `DYNASTY`, `DEVY`, `ROOKIES`, `ADP`, projections, injuries, news, and player-points can be rolled out or disabled independently.
- [x] Add a safe FantasyPros smoke/diagnostics command that checks planned endpoints and prints only status, row counts, freshness, expert counts, and errors, never the API key or raw payload.
- [x] Expand the FantasyPros client to support all useful NFL ranking types: `DRAFT`, `ROS`, `DYNASTY`, `DEVY`, `ROOKIES`, `ADP`, `DYNADP`, and `RKADP` where available.
- [x] Wire FantasyPros `DYNASTY` rankings into the dynasty valuation blend as a true dynasty source with its own adaptive trust weight, separate from redraft/season values.
- [x] Wire FantasyPros `DEVY` rankings into the devy/prospect blend and compare against Flock, KTC Devy, and Prospect Archive before raising its weight.
- [x] Archive historical FantasyPros consensus ranking snapshots from the API for `DYNASTY`, `DRAFT`, `ROS`, `ADP`, `DYNADP`, `RKADP`, `DEVY`, and `ROOKIES`, with source `last_updated`, expert counts, scoring, date policy, and source-specific formats preserved for future reblends.
- [ ] Wire FantasyPros `ROOKIES` rankings into rookie/prospect valuations and rookie draft decision reads.
- [ ] Wire FantasyPros `ADP`, `DYNADP`, and `RKADP` into draft-cost context, value-over-cost reads, and admin source diagnostics.
- [x] Keep FantasyPros `DRAFT` and `ROS` rankings in the redraft/current-season space only, with scoring-aware `PPR`, `HALF`, and `STD` profiles.
- [ ] Add FantasyPros projections after validating the endpoint under normal rate limits; use weekly, preseason, and rest-of-season projections for lineup strength, matchup preview, and redraft valuation support.
- [ ] Use FantasyPros player-points history to validate prior-season production, weekly consistency, and value-confidence calibration.
- [ ] Use FantasyPros injuries and practice-report probabilities in player availability, lineup risk, and AI confidence notes.
- [ ] Use FantasyPros news categories for player-specific news, injury, transaction, rumor, and breaking-news context, then connect news timestamps to value movement when snapshots overlap.
- [x] Normalize or enrich `latestNews.url` from upstream news payloads so the player modal's latest-news card stays clickable whenever the source provides a link.
- [ ] Use FantasyPros player IDs and external IDs to improve cross-source identity matching for ESPN, Yahoo, MFL, Fleaflicker, Fantrax, NFL, CBS, DraftKings, and other platform IDs.
- [ ] Add expert metadata and expert publication timestamps to admin diagnostics so stale or thin expert sets lower source trust automatically.
- [ ] Evaluate the FantasyPros compare-players endpoint for player modal context and trade comparison explainers.
- [x] Add cache/rate-limit protection for FantasyPros calls so report generation does not hammer the API during refresh jobs.
- [x] Add admin-only visibility for FantasyPros endpoint coverage, effective weights, trust movement, stale data, and high-impact valuation changes.
- [ ] Add FantasyPros to the per-player source trace UI so admins can see exactly whether `DRAFT`, `ROS`, `DYNASTY`, `DEVY`, ADP, news, injuries, or player-points affected a player read.
- [ ] Add unit tests for each FantasyPros payload normalizer and integration tests for dynasty, redraft, devy, rookie, ADP, injury, news, projection, and player-points diagnostics.

## Draft Baseline / League Mode Roadmap

- [x] After deployment, run the expanded production smoke checks for all four target leagues: `Skids Get Beat`, `The Fantasy Degenerates`, `test league`, and `Gov Tech Grid Iron`.
- [x] Re-check weekly risers and fallers on May 14 or May 15, 2026 after the temporary May 7 baseline floor ages out of the 7-day lookback; production DB audit compared `2026-05-15` against `2026-05-08`.
- [x] Extreme weekly percentages still appear after the 7-day lookback catches up; investigated source volatility, tiny baseline/current values, and source identity mismatches. Weekly movement rows now reuse a report relevance gate so fringe/unranked TE20-style movement does not surface as user-facing risers/fallers.
- [x] Keep 2026 rookie draft labels as `Early Riser` and `Early Faller` through preseason, then switch to `Hit` and `Miss` when the season evaluation window opens.
- [x] Add an admin-only weekly movement anomaly report for extreme movers, low-denominator baselines, and suspicious source swings.

## Waiver / Trade Intelligence Roadmap

- [ ] Review waiver `won/lost` and trade `acted/blocked` outcomes after enough real samples accumulate, then tune confidence weights against actual results.
- [ ] Track in-season usage trends over the course of the season, especially targets, rush attempts, and snap share, so waiver calculations can surface players whose role is growing before the box score catches up.
- [ ] Add an admin accuracy panel for prediction quality by module: waiver bid range, waiver competition, trade resistance, and depth-chart role confidence.
- [x] Extend Full Trade Ledger balancing-piece suggestions from trade-time players to trade-time picks by reconstructing historical pick inventory per roster/date; never suggest a pick unless that manager actually controlled it at the time of the deal.
- [x] Add historical Sleeper backfill observability showing scanned league IDs, transaction counts, seasons loaded, failures, and broken `previous_league_id` chains.
- [x] Add depth-chart cache health diagnostics showing last warm time, loaded teams, failed teams, retry count, and stale team coverage.
- [ ] Move recommendation outcome detection into a backend job so confidence can improve even when the user does not reopen the report UI.
- [x] Remove the legacy `trade-recommendation-outcomes:v1` localStorage migration read after shared action-plan storage has been live long enough.

## Completed Features

### Core Infrastructure
- [x] Header layout finalized: Dynasty Degenerates logo/title on left, league name (larger font) on right
- [x] League logo from Sleeper API displayed next to league name in header
- [x] All section headers centered across all tabs
- [x] Footer section with "Analyze Another League" and "Export CSV" buttons
- [x] Input field label and league ID value centered on landing page
- [x] All tables updated with consistent centering (flex justify-center wrappers)
- [x] Dynasty Degenerates logo set as favicon

### Draft History Tab
- [x] Draft History tab created with Full Draft Board and Draft Capital Efficiency tables
- [x] Redraft Draft History now stays visible for prior-year draft history when draft data exists, while no-draft redraft leagues hide the empty draft surface and fall back to Overview from `#draft`.
- [x] Draft data fetching updated to pull from both current and previous league seasons
- [x] Filter added to only include rookie drafts with fewer than 100 picks
- [x] Manager names correctly resolved using user_id-to-name mapping
- [x] Draft Capital Efficiency numbers rounded to whole numbers (no decimals)
- [x] Color-coded value change indicators (green/red with trending arrows) implemented
- [x] Draft picks display with proper KTC value matching using slug-based lookup
- [x] Table widths made consistent: Draft Capital Efficiency (max-w-6xl) and Full Draft Board (max-w-7xl)

### KTC Historical Data Integration
- [x] Wayback Machine scraper infrastructure created
- [x] May 2025 KTC rookie data successfully scraped from archive (96 players)
- [x] Verified correct values: Ashton Jeanty = 7830, Omarion Hampton = 6241
- [x] waybackMachineScraper.ts created with getMay2025KTCSnapshot() function
- [x] draftAnalysis.ts updated to use May 2025 KTC values for value change calculations
- [x] routers.ts updated to pass May 2025 KTC data to analyzeDraftPicks
- [x] Value Change column now shows accurate draft-day value comparisons
- [x] Flexible slug matching implemented to handle both simple and hyphenated player slugs
- [x] Browser tested: Value changes correctly calculated (e.g., Ashton Jeanty -364, Omarion Hampton +556)
- [x] Position rank data extracted from May 2025 snapshot (60+ players with RB/WR/QB/TE rankings)
- [x] Position Rank (May 2025) column added to Draft Board table
- [x] DraftPick interface updated with position rank fields
- [x] Browser tested: Position ranks displayed correctly (e.g., Ashton Jeanty RB3, Omarion Hampton RB5)
- [x] All 22 unit tests passing

### Database & Scheduled Jobs
- [x] ktcSnapshots database table confirmed to exist and be properly configured
- [x] KTC Tuesday 11 PM snapshot job confirmed in place (ktcSnapshotJob.ts + scheduledJobs.ts)

### Draft Year & Position Rank Tracking
- [x] Add draft year labels (2025 vs 2026) to Full Draft Board
- [x] Add Current Position Rank column to Draft Board
- [x] Add Position Change column (green/red with spot movement)
- [x] Fetch current KTC position ranks for all players
- [x] Calculate position rank changes (current - May 2025)
- [x] Created currentKTCLoader.ts to load current position ranks
- [x] Updated draftAnalysis.ts to handle position rank calculations
- [x] Updated DraftAnalysis.tsx to display all new columns
- [x] Browser tested: Position changes displaying correctly (e.g., Ashton Jeanty +1, Travis Hunter +3)
- [x] All 22 unit tests passing

### Live KTC Scraper Integration (Superflex)
- [x] Create liveKTCScraper.ts to fetch current KTC rankings from keeptradecut.com
- [x] Parse playersArray JSON from KTC page (500+ players)
- [x] Extract position ranks (RB1, RB2, WR1, etc.) and KTC values from Superflex data
- [x] Use pre-calculated superflex.value and superflex.positionalRank fields
- [x] Update currentKTCLoader.ts to use live scraper instead of static file
- [x] Ensure position rank changes calculate correctly with live Superflex data
- [x] Browser tested: Live Superflex KTC data displaying correctly (Josh Allen 9998, Bijan Robinson 9993, etc.)
- [x] All 22 unit tests passing
- [x] Set up weekly scheduled job to run live KTC scraper (e.g., Tuesday 11 PM)
- [x] Store weekly KTC snapshots in database for historical tracking

## Future Features (Optional)
- [x] Waiver wire activity tracker tab (covered by Weekly Momentum trending adds/drops plus Overview Waiver Intelligence)
- [x] Bench vs Start analysis (covered by projected starter room, bench baseline, and starting roster strength modules)
- [x] Historical KTC tracking for non-rookie drafts (covered by stored weekly market snapshots and 7-day comparison logic)
- [x] Draft class comparison tools (covered by Draft Decision Audit plus dynasty/college rankings boards)

## Current Issues to Fix
- [x] Draft year showing 2026 instead of 2025 for all picks
- [x] Manager names showing "Unknown" instead of resolved names
- [x] Remove Year column from Full Draft Board table
- [x] Remove Draft Pick Position column from Full Draft Board table
- [x] Rename "Position Rank (May 2025)" to "Drafted Rank"
- [x] Rename "Current Position Rank" to "Current Rank"
- [x] Fix table width to prevent column cutoff
- [x] Add header "2025 Rookie Draft" (or appropriate year) above Full Draft Board table

### Draft Capital Efficiency Interactive Feature
- [x] Make manager names clickable in Draft Capital Efficiency table
- [x] Create modal component to display manager's draft picks
- [x] Modal shows: Player Name, Position, Position Change, Value Change
- [x] Test modal functionality and ensure all tests pass

### KTC Data Expansion
- [x] Updated live KTC scraper to fetch 500 players across 10 pages instead of just first page
- [x] Fixed data incongruences for Trevor Etienne and Jarquez Hunter by expanding scraper reach
- [x] Verified all 22 tests passing after scraper update

### Data Quality Fixes
- [x] Fixed Jarquez Hunter and Trevor Etienne showing WR90 instead of N/A when not in current KTC data
- [x] Updated draftAnalysis.ts to return null instead of fallback values
- [x] All 22 tests passing after fix

### Hit/Miss Threshold Update
- [x] Updated hit/miss calculation thresholds from 5 position ranks/500 value to 10 position ranks/750 value
- [x] All 22 tests passing after threshold update

### Modal & Sorting Enhancements
- [x] Added Current Rank and Current Value columns to manager draft picks modal
- [x] Made Current Value column sortable in Full Draft Board table (ascending/descending)
- [x] Made Value Change column sortable in Full Draft Board table (ascending/descending)
- [x] Added visual indicator (arrow icon) to show which column is sorted
- [x] All 22 tests passing after enhancements

### Position Depth & Manager Position Counts
- [x] Update Position Depth Analysis thresholds (QB: 4/5, RB: 8/12, WR: 8/12, TE: 4/6)
- [x] Add Manager Position Counts table to Overview page
- [x] Display QB, RB, WR, TE counts per manager
- [x] All 22 tests passing after changes

### Dynamic Position Depth Thresholds
- [x] Updated Position Depth Analysis to calculate thresholds dynamically
- [x] Thresholds now based on min/max of actual manager position counts
- [x] Shortage = below league minimum, Excess = above league maximum
- [x] All 22 tests passing after dynamic threshold implementation

### Player Headshots Feature
- [x] Attempted Sleeper API headshots (403 Forbidden - blocked)
- [x] Attempted NFL.com headshots (TLS connection errors blocking league data load)
- [x] Attempted Pro Football Reference headshots (403 Forbidden - blocked)
- [x] Attempted ESPN headshots (500 errors - blocked)
- [x] Implemented image proxy service with browser headers to bypass CDN restrictions
- [x] Created imageProxy.ts with caching service (7-day TTL)
- [x] Added images.playerHeadshot tRPC endpoint
- [x] Updated PlayerDetailModal to display headshots
- [x] All 22 tests passing

### Player Detail Modal for Draft Board
- [x] Create PlayerDetailModal component showing all player data in multi-row format
- [x] Make player names clickable in Full Draft Board table
- [x] Modal shows: Drafted Rank, Current Rank, Position Change, Current Value, Value Change, ADP, Manager, Round, Pick #
- [x] Optimize modal layout for mobile (no horizontal scrolling)
- [x] Update Full Draft Board table columns to show: Pick, Player, Position Change, Current Value, Value Change
- [x] Remove other columns from main table (Drafted Rank, Current Rank, ADP, Manager, Round, etc.)
- [x] Restore sorting for Current Value and Value Change columns
- [x] All 22 tests passing after changes

### Modal Refinements
- [x] Remove ADP field from player detail modal
- [x] Fix Draft Value to show original draft-time value (Current Value - Value Change)
- [x] All 22 tests passing after refinements

### GitHub Push & Table Updates
- [x] Push current state to GitHub
- [x] Simplify Trade Ledger table to show: Date, Winner, Loser, Gap (keep modal data as is)
- [x] Make entire rows clickable to open modals (Draft Board and Trade Ledger)
- [x] All 22 tests passing after changes

### Draft Capital Efficiency & Manager Picks Integration
- [x] Make entire rows in Draft Capital Efficiency table clickable to open manager picks modal
- [x] Update ManagerDraftPicksModal to support player detail modal on player row clicks
- [x] Player rows in manager picks modal open the same player detail modal as Draft Board
- [x] Keep dynasty Draft Capital Efficiency stats and manager drilldowns scoped to rookie draft picks only, while leaving redraft recap and full draft boards on their broader draft data.
- [x] All 22 tests passing after changes

### Starters Column in Draft Capital Efficiency
- [x] Add Starters column to Draft Capital Efficiency table
- [x] Count players with KTC value > 4000 for each manager
- [x] Display count in new Starters column
- [x] All 22 tests passing after changes

### Headshots Next to Player Names
- [x] Add small circular headshots next to player names in Draft Board table
- [x] Add small circular headshots next to player names in manager draft picks modal
- [x] Optimize headshot size for mobile readability (6px on mobile, 7px on desktop)
- [x] Use flexbox layout to keep text readable on mobile
- [x] All 22 tests passing after changes

### Headshots in Weekly Risers and Fallers
- [x] Add headshots next to player names in Weekly Risers table
- [x] Add headshots next to player names in Weekly Fallers table
- [x] All 22 tests passing after changes

### Manager Position Counts - Starters Sub-Columns
- [x] Add Starters sub-column next to QB count (QB S)
- [x] Add Starters sub-column next to RB count (RB S)
- [x] Add Starters sub-column next to WR count (WR S)
- [x] Add Starters sub-column next to TE count (TE S)
- [x] Count players with value > 4000 for each position
- [x] Update ManagerDraftStats type to include starter counts per position
- [x] All 22 tests passing after changes

### Trade Ledger Headshots
- [x] Add player headshots next to player names in Full Trade Ledger expanded rows
- [x] Display headshots for both team A and team B players
- [x] All 22 tests passing after changes

### Full Trade Ledger Timeline Lens
- [x] Show contender/rebuilder pills on Full Trade Ledger managers and use that lens for displayed player values, side totals, gap, and winner
- [x] Reconstruct each manager's contender/rebuilder state as of the actual trade date instead of only using the current report timeline snapshot
- [x] Add a small explanatory note or tooltip so managers know when a trade is being skewed by contender vs rebuilder value context

### KTC Scraper Trigger
- [x] Manually trigger KTC scraper to run now (should have run Tuesday 11 PM)
- [x] Verify fresh data is fetched and cached

### KTC Scraper Schedule Update
- [x] Change KTC scraper to run at 5 PM (17:00) Tuesday instead of 11 PM (23:00)
- [x] Update scheduledJobs.ts to reflect new time
- [x] Verify scraper still runs correctly at new time

## Current Debugging Tasks - COMPLETED

### Trade Ledger Headshots Issue
- [x] Debug why headshots not displaying in Full Trade Ledger expanded rows (was splitting by newline instead of comma)
- [x] Verify PlayerNameWithHeadshot component receives correct player names
- [x] Check if trade item parsing is stripping player names correctly (added filtering for picks/adjustments)
- [x] Test headshot display with sample trade data

### KTC Data Freshness Issues
- [x] Verify latest scrape (464 players) was actually cached and is being used
- [x] Check if weekly momentum is comparing correct data (fixed to use previous week snapshot)
- [x] Check if rookie draft comparisons are using May 2025 vs latest scrape (confirmed correct)
- [x] Verify value changes are calculating with fresh data
- [x] Update weekly momentum calculation to use latest scrape vs previous week snapshot
- [x] Update rookie draft to compare May 2025 vs latest scrape (already correct)

### Data Comparison Logic
- [x] Weekly Momentum: Now compares latest scrape to previous Tuesday snapshot (7 days ago)
- [x] Rookie Draft: Confirmed compares May 2025 snapshot to latest scrape
- [x] Verify both comparisons are using correct data sources

## UI & UX Audit (2026-05-04)

### 🔴 Critical Mobile Fixes (High Priority)
- [x] Fix text truncation on mobile hero heading ("OBLITERATE YOUR COMPETITION")
- [x] Make input fields full-width on mobile viewports (iPhone SE/12)
- [x] Stack "Find Leagues" button vertically below the username input on small screens
- [x] Ensure all buttons have a minimum 44px height for touch targets
- [x] Fix "For Degens" header text truncation on mobile

### 🟡 Layout & Spacing Improvements (Medium Priority)
- [x] Standardize vertical gaps between all landing page sections
- [x] Implement responsive padding using CSS `clamp()` for container edges
- [x] Adjust feature cards alignment and spacing on tablet viewports (iPad Pro)
- [x] Fix inconsistent form field spacing on mobile devices

### 🟢 Desktop & Accessibility Optimizations (Low Priority)
- [x] Optimize max-width for ultra-wide screens to reduce excessive whitespace
- [x] Improve feature cards visibility/interaction on mobile (consider carousel or better stacking)
- [x] Add subtle hover states and transitions for interactive elements
- [x] Verify accessibility contrast for all text elements on dark backgrounds

## Admin Premium Command Center Expansion

### Completed Admin/Premium Access
- [x] Rename privileged access constant from `PRIVILEGED_REPORT_VIEWERS` to `ADMIN_PERMISSIONS`
- [x] Gate new premium command-center features behind admin permissions
- [x] Add admin unlock modal / regular-view mode
- [x] Make admin-only tabs and tiles visually identifiable with a subtle premium glow
- [x] Tone down premium glow so it stays behind/inside admin feature tiles instead of washing over the whole report
- [x] Verify `ADMIN_PERMISSIONS` is configured for production/preview/dev

### Completed AI Read System
- [x] Add reusable `AIReadPanel` component
- [x] Support AI Read props for title, subtitle, read type, confidence, severity, chips, body, actions, compact mode, and background variant
- [x] Add AI Read visual language with dark Tron/blueprint styling, glowing border, schematic details, confidence meter, and neon chips
- [x] Add AI Read placements across overview, manager/team cards, player detail modal, rankings, draft history, trade history, and premium command-center modules
- [x] Add AI Read action language such as roster read, market signal, trade window, lineup leak, waiver opportunity, league exploit, and monthly blueprint

### Completed Premium Feature Modules
- [x] Monthly Team Blueprint report
- [x] Blueprint report partial-history warning so missing history is never silently invented
- [x] Blueprint copy/share text action
- [x] Blueprint print / save-PDF path
- [x] League Power Rankings
- [x] Team Breakdown and Roster Recon
- [x] Trade Finder / Fair Trade Generator
- [x] Trade Partner Finder
- [x] League Exploits module
- [x] Watch Alerts / Market Signals module
- [x] Local browser-saved watch thresholds
- [x] Local browser-saved watched players
- [x] Waiver / Free Agent Assistant
- [x] Lineup Optimizer / Starter Strength module
- [x] Portfolio View module
- [x] Local browser-saved portfolio snapshots
- [x] Cross-league exposure read when multiple league snapshots are saved locally
- [x] Rookie / Prospect Signal Score module
- [x] Research Assistant using returned FantasyPros/Sleeper news and status payloads
- [x] Matchup Preview shell with typed future `matchupPreviews` payload support
- [x] Matchup Preview schedule-pending state until real weekly matchup/projection data exists
- [x] Feature Coverage diagnostic showing Backed / Partial / Pending / Missing states
- [x] Expanded owner/team type taxonomy beyond contender/rebuilder
- [x] Add score-driven team type labels: Juggernaut, Strong Contender, Weak Contender, Balanced, Strong Rebuilder, Weak Rebuilder, and Pip Squeak
- [x] Add color-coordinated pills for expanded team type labels on owner cards and manager detail views

### Completed Data Honesty Rules
- [x] Do not fake historical snapshots when missing
- [x] Do not fake player news when no news/status payload exists
- [x] Do not fake weekly matchup projections before schedule-week matchup data exists
- [x] Mark local-only features clearly when server persistence is not available yet
- [x] Mark partial-data modules clearly in Feature Coverage

### Verification Completed
- [x] Typecheck passes with `corepack pnpm check`
- [x] Production build passes with `corepack pnpm build`
- [x] Local browser smoke verified admin feature radar renders
- [x] Local browser smoke verified watch preferences save
- [x] Local browser smoke verified portfolio snapshot saves
- [x] Local browser smoke verified no horizontal overflow
- [x] Production smoke passed for dynasty and redraft leagues

## Premium / Data Roadmap

### Matchup Preview - Waiting on Real Schedule Data
- [ ] After the NFL schedule release, confirm Sleeper exposes current-week matchup IDs, opponent rosters, submitted lineups, and projection context for the target leagues.
- [x] Add server-side matchup ingestion to populate `ReportData.matchupPreviews`.
- [x] Keep the schedule-pending empty state for offseason and pre-schedule periods.
- [x] Use the schedule-release feature checklist below so we do not miss other schedule-driven surfaces.

### Schedule Release Feature Checklist

- [x] Build schedule-release data ingestion and normalization for matchup IDs, opponent rosters, submitted lineups, bye weeks, and target weeks.
- [x] Populate `schedulePlanning` with roster gaps, streamer candidates, bye-window coverage, and schedule notes from the released NFL calendar.
- [x] Fill `ReportData.matchupPreviews` and the matchup preview UI with weekly win odds, opponent edge, boom/bust, must-start, and how-you-win analysis.
- [x] Add player-detail schedule cards for season SOS, bye weeks, streamer windows, and opponent difficulty so player views get real schedule context.
- [x] Wire schedule context into `CommandCenterExpansion`, `PlayerDetailModal`, `AITeamAutopilot`, and `LeagueCommandCenter` so the same schedule data powers every surface without diverging.
- [x] Add schedule-aware autopilot guidance for roster gaps, start/sit calls, streamer targets, waiver timing, and priority actions.
- [x] Add D/ST and matchup-streamer logic driven by schedule strength, bye-week pressure, and upcoming opponent difficulty.
- [ ] Add waiver timing and bench-stash guidance for upcoming bye-week cliffs and short-term lineup pressure.
- [ ] Feed schedule context into redraft lineup strength, valuation, and confidence only after freshness checks pass.
- [ ] Add schedule-aware trade and dynasty context for short-term contention windows, playoff pushes, and easy/hard stretches.
- [ ] Add schedule badges or notes in Overview and owner-level surfaces when schedule context changes the read.
- [x] Add tests for schedule normalization, matchup mapping, bye-window rendering, streamer candidate generation, and fallback/offseason states.
- [ ] Add QA coverage for schedule-dependent surfaces across Overview, Command Center, Matchup Preview, Player Detail, Autopilot, Rankings, and trade/waiver modules.
- [x] Keep pre-schedule and offseason empty states honest until the data exists.

### Watch Alerts - Server Persistence
- [ ] Move watch thresholds from browser-local storage to user/server persistence.
- [ ] Add account-level watchlist persistence.
- [ ] Add alert delivery options later, such as in-app notifications, email, or scheduled reminders.
- [ ] Add threshold controls per watched player instead of only global rise/fall thresholds.

### Portfolio View - True Multi-League
- [ ] Persist multi-league snapshots server-side instead of relying only on browser-local snapshots.
- [ ] Add account-level player shares across all synced leagues.
- [ ] Prototype a Flock-style player exposure view that counts each player across synced leagues and shows share/exposure percentage by player.
- [ ] Add overexposure, underexposure, injury/news risk concentration, and total portfolio value across leagues.
- [ ] Add league-by-league portfolio comparison and exposure filters.

### Blueprint Export / Sharing
- [ ] Add true rendered image export for Team Blueprint.
- [ ] Add polished PDF export beyond browser print.
- [ ] Add shareable report link or saved blueprint artifact.
- [ ] Add team branding and league branding to the exported artifact.

### News / Research Assistant
- [ ] Confirm production FantasyPros news API coverage and rate limits.
- [x] Add a snapshot-backed alternate news source path for SportsDataIO/RotoBaller so player news can merge FantasyPros plus licensed SportsDataIO news when `ENABLE_SPORTSDATAIO_NEWS=true` and `SPORTSDATAIO_API_KEY` are configured.
- [ ] Validate SportsDataIO/RotoBaller news production package access, endpoint shape, rate limits, and player ID mapping before making it a required source-health signal.
- [ ] Add `FANTASY_NERDS_API_KEY` to production env after confirming the live package returns current-season rows, then verify Fantasy Nerds redraft and dynasty diagnostics load cleanly.
- [ ] Revisit GridIron Data once a key or package is available and decide whether it belongs in redraft projections, player news, or source health only.
- [ ] Revisit MySportsFeeds if they approve access, and keep it out of the blend until endpoint coverage and licensing are confirmed.
- [ ] Add source and status diagnostics when news payloads are unavailable.
- [x] Add first-pass value-movement-after-news analysis when player news exists and current/baseline value snapshots overlap; player detail AI traces now say whether news coincided with meaningful stored value movement.
- [ ] Add role and depth-chart change detection when reliable source data exists.
- [x] Add a snapshot-backed nflverse/ffverse draft-capital source so player detail and cohort AI reads can use public Sleeper/GSIS/FantasyPros/ESPN IDs, draft year, round, overall pick, draft team, and college without live provider calls during report loads.
- [x] Add `pnpm audit:situation-delta-sources` to the normal source-audit review before Player Situation Delta work so public dataset coverage, prospect snapshot years, and missing licensed route data stay visible.

### Player Value Timeline / Situation Delta
- [x] Add first-pass player value timeline data to player detail payloads from stored blended value snapshots.
- [x] Add a compact player detail graph showing stored blended value movement, latest rank, source count, and source-mix change warnings.
- [x] Add event markers to the graph for draft picks, trades, injuries, depth-chart movement, vacated-opportunity openings, and roster-room squeezes.
- [ ] After the next production KTC/value scrape runs, verify it writes both `ktcSnapshots` and normalized `playerValueSnapshots`, including row counts, latest snapshot timestamps, and a few sample players such as Drake London and Bijan Robinson.
- [ ] After one full seven-day window of new scrapes, re-check Weekly Momentum risers/fallers and confirm current values compare against the DB snapshot from seven days earlier, not deleted local `server/ktc-snapshots` files or stale fallback data.
- [ ] Production-smoke the player value timeline modal after the new scrape: confirm 1M/3M/6M/1Y/All windows update, the graph includes the newest point, and normal users see graph-first movement instead of the old snapshot source-history list.
- [ ] Replace or intentionally retire the skipped dynasty snapshot replay fixture now that checked-in `server/ktc-snapshots` JSON files have been removed.
- [x] Add a rookie valuation mismatch table that compares current rookie price against prospect profile, draft investment, and roster-room opportunity.
- [x] Add player-detail AI read copy that references value timeline movement directly when the value move is backed by situation-delta evidence.
- [x] Add a source-history admin panel for individual players so we can inspect KTC, FantasyCalc, DynastyProcess, Flock, Dynasty Nerds, and blended-value disagreements over time.
- [x] Backtest rookie riser/faller labels against the 2025 and 2026 draft-window baselines before making strong automated trade recommendations from them.

### Command Center Polish
- [ ] Add deeper mobile QA for all premium cards after real matchup data lands.
- [x] Collapse full AI readouts into compact mobile cards with one-line takeaways and Playwright coverage across Overview, Blueprint, Rankings, and Trade History.
- [x] Add admin AI readout coverage diagnostics for readout count by tab, missing traces, missing confidence, duplicate-risk flags, and source-limited reads.
- [x] Add visible "Why this fired" traces to owner-level AI readouts so roster, rank, trade, market, and source signals are explainable in the actual report UI.
- [x] Add E2E coverage for admin-only feature visibility.
- [x] Add E2E coverage for local watch preference persistence.
- [x] Add E2E coverage for portfolio snapshot persistence.
- [x] Add E2E coverage for blueprint print and share controls where practical.

## Report UX / Tooling Roadmap

### ReportTables Split - Remaining Work
- [x] Split `TradeWarRoom` out of `client/src/components/ReportTables.tsx` into a real lazy-loaded module.
- [x] Split `TradeHistoryTable` out of `client/src/components/ReportTables.tsx` into a real lazy-loaded module.
- [x] Split `TradeProfitLeaderboardTable` out of `client/src/components/ReportTables.tsx` into a real lazy-loaded module.
- [x] Keep shared trade/value helpers centralized so split modules do not duplicate logic.
- [x] Run typecheck, unit tests, build, and focused e2e after each split.

### Dirty Worktree Reconciliation
- [x] Separate report UX and tooling changes from unrelated auth, OAuth, and server cleanup changes before committing.
- [x] Review deleted auth and server files and confirm each deletion is intentional.
- [x] Review docs and todo changes separately from runtime code changes.
- [x] Keep `server/dynastySourceTrust.ts` and `server/valueBlend.ts` cleanup isolated from report UX work so typecheck fixes stay easy to verify.
- [x] Refresh the redraft trade-ledger screenshot regression whenever that UI is touched again.
- [x] Stage the final commit in logical groups instead of one mixed worktree commit.

### Production Smoke After Deploy
- [x] After deployment, run the manual `Production Smoke` GitHub workflow against `https://dynastydegens.com`.
- [x] Verify dynasty leagues `Skids Get Beat` and `The Fantasy Degenerates` still render dynasty copy, draft capital and main draft surfaces, rookie draft surfaces, and trade-value context correctly.
- [x] Verify redraft leagues `test league` and `Gov Tech Grid Iron` still avoid dynasty-first copy and prioritize current-season values.
- [x] Verify redraft draft-tab semantics: `Gov Tech Grid Iron` keeps previous-year draft history, `test league` keeps current draft history, and cached no-draft redraft reports hide the empty Draft History tab.
- [x] Confirm internal draft baseline comparison dates are not exposed in the deployed report UI.
- [x] Confirm deployed console logs do not show app errors on desktop or mobile.

### Bundle Cleanup
- [x] Use `pnpm run build:analyze` to inspect `dist/bundle-stats.html` before the next performance pass.
- [x] Reduce the remaining large `RecentTransactionsPanel` lazy chunk.
- [x] Reduce the large `WaiverIntelligencePanel`, `TradeTheftDetector`, and `TradeMarketRadar` lazy chunks while leaving `SuccessCard3D` for last.
- [x] Check whether shared helpers pulled from `ReportTables.tsx` keep too much code in downstream chunks.
- [x] Reduce the deferred `SuccessCard3D` lazy chunk by removing the postprocessing bloom path and adding reduced-motion/non-WebGL fallback rendering.
- [x] Consider extracting trade-ledger helpers into a non-React utility module once `TradeHistoryTable` and `TradeWarRoom` are split.

### Research / Product Ideas
- [x] Investigate FantasyPros VORP rankings on [FantasyPros VORP](https://www.fantasypros.com/nfl/rankings/vorp.php), confirm how the metric is calculated, and decide whether it should inform any existing valuation or draft surfaces.
- [x] Check whether the Sleeper API exposes draft data or trade data from leagues beyond our own so we can store it for later analysis and product ideas.
- [x] Summarize the top fantasy football + AI YouTube videos and extract any repeat ideas, workflows, or features we could implement.
- [x] Outline how a Chrome extension could help draft players using multiple criteria, rankings, and context signals.
- [x] Trace any existing references to the AI chatbot in the codebase and docs, then explain what it currently does or where it still needs to be defined.
- [x] Review [Dynasty Daddy fantasy rankings](https://dynasty-daddy.com/fantasy-rankings/lamarjacksonqb?league=1312139584427012096&year=2026&platform=0&userId=472986961783549952&teamId=3) for feature ideas, layout ideas, and any useful ranking or league-context capabilities we should consider.
- [ ] Build a competitor-inspired Trade Intelligence Hub from FantasyPros, KTC, RosterAudit, Dynasty Nerds, RotoTrade, DraftWiz, and DynastyGPT ideas: one surface for trade finder, trade grading, player/pick comps, closest-value counters, consolidation warnings, roster-fit warnings, and manager-specific acceptability. It should power Trade War Room, trade ledgers, player modals, and AI trade readouts.
- [ ] Add a real-trade comp explorer inspired by RosterAudit/FantasyCalc-style market data: search by player, pick, position bucket, package size, scoring format, league size, and time window; show accepted trade examples, median package shape, overpay/underpay bands, and confidence. Use it for valuations, trade readouts, draft recommendations, and "what would this manager accept" suggestions.
- [ ] Add owner scouting and negotiation profiles inspired by DynastyGPT/RosterAudit: each manager gets trade behavior, pick-hoarding, contender/rebuilder bias, roster-construction habits, position shopping lists, past deal grades, and negotiation notes. Use it for Trade War Room counters, rivalry ledgers, manager inventory, and AI trade explanations.
- [ ] Add a dynasty draft and rookie-pick command center inspired by Dynasty Nerds/Dynasty Daddy/DynastyGPT mock tools: likely available players by pick, trade-up/trade-down partners, rookie ADP vs blended value, class-strength tiers, landing-spot opportunity, and pick liquidity. Use it for rookie drafts, draft pick valuations, breakout reads, and rebuild plans.
- [ ] Add a weekly lineup and waiver command center inspired by FantasyPros, DraftWiz, RotoTrade, and Draft Sharks: start/sit, add/drop, top available, FAAB bid range, matchup/SOS, injury/practice risk, roster needs, and opponent blocking. Use it for redraft reports, contender mode, waiver intelligence, and weekly AI readouts.
- [ ] Add a portfolio and exposure dashboard inspired by FantasyPros Multi-League Assistant and Dynasty Nerds Team Portfolio: player shares, risky overexposure, stack/correlation, bye-week clusters, injury clusters, rebuild/contender exposure, and cross-league buy/sell alerts. Use it for multi-league users, player valuations, and weekly risk notes.
- [ ] Add player trajectory cards inspired by RotoTrade pros/cons, Dynasty Nerds data hub, and DraftWiz rationale: value history, source-rank movement, production vs opportunity, depth-chart competition, coaching/play-calling context, injuries, contract age, and clear buy/sell/hold reasons. Use it for player modals, rankings, trade readouts, and breakout/regression reports.
- [ ] Add league content generation inspired by DynastyGPT: weekly league recap, matchup preview, manager spotlight, trade reaction, rivalry note, and power-ranking movement copy generated from real rosters, standings, trades, waivers, and manager profiles. Keep it optional and league-specific so it adds context without replacing the core report.
- [x] Add a one-time historical value archive pipeline that stores immutable raw source history locally, imports approved CSV/JSON value exports, reblends derived timelines when weights change, and backtests riser/faller outcomes without mutating the original source archive.
- [x] Add a controlled one-time KTC/Flock historical source backfill runner using direct KTC player value graph payloads and direct Flock clicked-player ranking history endpoints, with date windows, throttling, resume/sample controls, league-format capture, and frozen raw source archive output.
- [x] Run the one-time four-year historical value backfill from direct player pages/API endpoints, then archive the raw source values by player/date/source/league format so future blend-weight changes can regenerate charts from the same frozen inputs.
- [x] Add FantasyCalc and FantasyPros to the frozen source-history archive: FantasyCalc direct player value histories for dynasty Superflex/1QB, FantasyPros ranking snapshots for dynasty/redraft/ADP/devy/rookie context, and merged source-coverage audits before reblending.
- [x] Add partial Dynasty Nerds and Fantasy Nerds history from stored Dynasty Degen source snapshots, keep the source metadata explicit, and do not import Fantasy Nerds `TEST` API rows or claim full source-native history when only local snapshots exist.
- [x] Add a weighted-value source registry and coverage audit so KTC/Flock are only the first archived sources, while FantasyCalc, FantasyPros, DynastyProcess, Dynasty Nerds, Fantasy Nerds, benchmark-only sources, and future licensed usage providers all have an explicit archive/import status before they can affect future blend weights.
- [x] Add a waiver AI trust gate and admin review list so thin or guessed waiver candidates are omitted from user-facing pickup ideas, with reasons for deeper source review instead of leaking names like Dallen/Dallas Bentley into AI recommendations.
- [x] Normalize historical value identities with high-confidence suffix/name merges only, preserve kicker/defense/IDP rows for formats that use them, and re-audit/reblend the canonical archive.
- [x] Add historical value weight calibration plus a compact player timeline index so player modals can show 3M/6M/1Y/all-time value, positional rank, and all-time high/low dates from the frozen archive.
- [x] Create a compressed local value-history backup bundle with checksums, plus provider-specific import templates and a merge command so approved future source exports can join the same raw archive before reblending.
- [ ] Build a future Redraft Draft Coach / draft-outcome warehouse that stays separate from the dynasty value-history archive and uses historical draft cost, roster construction, and actual season outcomes to recommend who to select in redraft leagues and why.
  - [x] Audit public internet sources for redraft draft-strategy and league-winner evidence, and document that public articles/datasets are useful benchmark priors but do not replace app-owned aggregate champion draft-path analysis. See `docs/redraft-draft-strategy-source-audit.md`.
  - [ ] Build a public benchmark registry for aggregate/player-level strategy priors from Fantasy Points, CBS, Yahoo championship roster recaps, Kaggle ADP/stat datasets, and similar sources, with source confidence and redistribution notes.
  - [x] Build an aggregate-only redraft draft-winner analyzer that accepts known/shared Sleeper league IDs, counts champion and top-points position sequences by format bucket, and prints only aggregate JSON without storing raw league/user/player rows.
  - [x] Extend the aggregate-only redraft draft-winner analyzer with username-linked manager-network discovery, completed-season-only defaults, strict depth/manager/league/rate caps, optional aggregate JSON output, and no raw league/user/player persistence.
  - [x] Retain the sanitized aggregate-only redraft strategy evidence layer in `server/redraft-draft-outcomes/redraft-draft-outcomes-v2-baseline.json`, with format, season, draft type, draft slot, opening-sequence, champion-strategy, and top-points cross-check counts but no raw league/user/roster/player rows.
  - [x] Build the app-facing derived strategy rules file in `server/redraft-draft-outcomes/redraft-strategy-rules-v1.json` plus `pnpm build:redraft-strategy-rules`, so the future Draft Coach can load confidence-scored format rules without parsing the full aggregate every time.
  - [ ] Later, wire `redraft-strategy-rules-v1.json` into the Draft Coach experience: match the current league format bucket, apply draft-slot notes, explain first-round lean/avoid guidance, and label recommendations as strong, medium, close-call, thin, or research-only.
  - [ ] Store Sleeper redraft draft boards from user-loaded or explicitly shared leagues with draft slot, round, pick number, player, roster position, league size, scoring, lineup slots, draft type, and timestamp.
  - [ ] Backfill final redraft season outcomes for those same leagues: standings, points for, playoff teams, champion, weekly matchups, submitted lineups, optimal lineup where available, transactions, and final rosters.
  - [ ] Normalize league format buckets before comparing drafts: 1QB vs superflex, 10/12/14 teams, PPR/half/standard, flex count, bench size, TE premium, kicker/DST settings, snake vs auction, and draft slot.
  - [ ] Snapshot approved redraft ADP/ECR/projection/auction-value sources at draft time so every pick can compare actual draft cost against pre-draft expectation without relying on future rankings.
  - [ ] Classify roster-construction strategies by draft path: RB/RB, WR/WR, hero RB, zero RB, elite QB early, late-round QB, early TE, punt TE, balanced start, upside bench, floor bench, handcuff-heavy, and bye-week-aware builds.
  - [ ] Measure which draft paths actually win by comparable format bucket, while controlling for draft slot, injury luck, waiver activity, trade activity, lineup quality, manager activity, and league sharpness.
  - [ ] Add draft-pick outcome labels such as value hit, value miss, injury miss, role miss, ADP steal, reach that worked, reach that failed, league-winner pick, replacement-level pick, and dead roster spot.
  - [ ] Build redraft draft strategy backtests that answer questions like "Should this format take QB early?", "When does RB dry up?", "Which positions are usually over-drafted here?", and "What player archetypes outperform ADP?"
  - [ ] Turn the warehouse into a live draft recommendation engine that explains best pick, next-best pivots, tier cliffs, positional scarcity, roster fit, expected next-pick availability, bye/injury risk, and why the recommendation is close or strong.
  - [ ] Add admin diagnostics for redraft draft data coverage: league count, season count, format buckets, missing draft boards, missing final standings, stale ADP/projection snapshots, identity-match confidence, and suspicious/incomplete leagues.
  - [ ] Keep user-load calls limited to Sleeper current-state/explicit league data and use scheduled or maintenance jobs for redraft source snapshots, draft-outcome backfills, and strategy backtests.
