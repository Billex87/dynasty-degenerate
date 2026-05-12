# Dynasty Degenerates - Project TODO

- Canonical item-by-item execution prompt: [docs/todo-list-execution-prompt.md](docs/todo-list-execution-prompt.md)

## Premium UX / Three.js Roadmap

- [ ] Rebuild the loading and report-generated modals as true Three.js scenes, not just CSS polish. Target a premium fantasy-football command-center feel: a cinematic 3D football fly-by on a real low-to-high arc, a depth-field loading stage, a textured league-logo coin/medallion, and a physical `REPORT GENERATED` stamp slam with ripple shockwaves, subtle camera thud, light sweep, and restrained glow.
- [ ] Keep the experience responsive and production-safe: code-native readable text/actions, desktop/tablet/mobile framing, reduced-motion fallback, graceful non-WebGL fallback, and no blocking of report generation if the 3D scene fails.
- [ ] Add visual QA coverage for the modal rebuild with Playwright screenshots and canvas checks across desktop and mobile viewports so the animation is nonblank, correctly framed, and visibly 3D before shipping.
- [ ] Evaluate a subtle Three.js command-center backdrop for the generated report shell: layered 3D field/grid depth, premium tron-line movement, light sweeps, and parallax that make the report feel alive without reducing table readability or hurting scroll performance.
- [ ] Upgrade player detail moments with restrained 3D depth where it adds signal: player/value medallion, confidence ring, market-movement pulse, and source-weight orbit that visually explains why the AI read is high or low confidence.
- [ ] Explore Three.js reveal treatments for high-value intelligence modules such as Waiver Intelligence, Trade War Room, Weekly Momentum, and Rankings: small 3D radar/scanner/market-map scenes that support the data instead of replacing it.
- [ ] Add an admin-only Three.js source-health cockpit concept for dynamic valuation trust: source nodes, drift warnings, confidence changes, and dynasty/redraft weight movement shown as an interactive 3D map for quick anomaly spotting.
- [ ] Build any Three.js expansion behind a shared lazy-loaded scene layer with strict performance budgets, feature flags, reduced-motion/static fallbacks, and mobile battery/GPU checks before enabling it broadly.

## Data Operations Roadmap

- [ ] Confirm production rights/terms for FantasyPros before treating it as a primary paid/API data source.
- [ ] Keep Fantrax out of the blend until we confirm a stable API or approved integration path.
- [ ] Revisit KeepTradeCut trade-database access later; only integrate it if we can get a stable, approved data path instead of a brittle scrape.
- [ ] Confirm whether DraftSharks partner REST API/docs require a partner login or API key, and whether access is only available through their affiliate/control-panel workflow.
- [ ] On May 14, 2026, run the projections/SOS rollout checklist below before wiring any schedule-dependent feature to live data.
- [ ] Run one-off source-health history backfill with `ENABLE_SOURCE_HEALTH_BACKFILL=true` after production cached reports exist.
- [ ] Configure `SOURCE_HEALTH_ALERT_WEBHOOK_URL` for Slack/email/webhook alert delivery in production.
- [ ] Calibrate player value confidence thresholds after enough 2026 source snapshots, trades, waivers, and injury/news events accumulate.
- [ ] Document a single-key leak response plan for API providers that will not rotate/reissue keys, including immediate disable steps, deploy rollback steps, and local/prod secret audit steps.
- [ ] Add a production-only API budget and rate-limit dashboard showing call volume, failures, 429s, cache hit rate, and highest-cost jobs by provider.
- [ ] Add a new-source probation rule: every new API/feed starts at low effective weight until it has enough stable snapshots, healthy row counts, and acceptable source-consensus drift.
- [ ] Add snapshot replay/regression tests that run old stored snapshots through current blend logic and flag unexpected value, rank, or source-weight changes.

## Monetization / Auth Roadmap

- [ ] Keep the public funnel low-friction: allow unauthenticated users to run a limited free Sleeper report before asking them to create an account.
- [ ] Define the first pricing model before building billing gates: Free, Pro, League Pass, and Elite tiers.
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
- [ ] Do not use personal/non-commercial API keys inside paid/public feature outputs unless we have provider approval or a commercial license for that source.
- [ ] Add tests for auth token expiry, magic-link replay protection, webhook signature verification, entitlement checks, usage limits, and paid/free report boundaries.

## Source Audit / Feature Roadmap

- [ ] Audit every live API, partner feed, and scrape we use today, including Sleeper, FantasyPros, DraftSharks, KeepTradeCut, Flock Fantasy, FantasyCalc, Dynasty Nerds, Fantasy Nerds, DynastyProcess, Prospect Archive / NFL Draft Buzz, ESPN prospect metadata, and any internal snapshot jobs.
- [ ] For each source, document exactly what comes back: endpoint or URL, auth model, rate limits, payload shape, unique IDs, timestamps/freshness, row counts, and known gaps or failure modes.
- [ ] Write down which features each source can power now vs later so we can spot unused data before adding more integrations.
- [ ] Save a compact sample payload or field map per source so the team can compare feeds without needing a fresh live fetch.
- [ ] Turn that audit into a source coverage matrix in admin so we can see at a glance what each API or scrape is actually returning.
- [ ] Use this compact template for each source during the audit: `Source / Returns / Used now / Could power later / Open questions`.
- [ ] Sleeper - Returns: league settings, rosters, players, matchups, waivers, trades, news/status, and user/player IDs. Used now: league analysis, roster intelligence, matchup preview plumbing, waiver/trade analysis, and identity matching. Could power later: schedule-week matchup reads, exposure views, alerting, and lineup guidance. Open questions: which endpoints reliably expose current-week matchup and projection context.
- [ ] FantasyPros - Returns: rankings, projections, ADP, injuries, news, compare-players, player-points, and player/external IDs. Used now: dynasty/redraft blends, rookie and devy context, injury/news notes, player modal details, and confidence calibration. Could power later: lineup strength, value movement, matchup preview, and trade explainers. Open questions: rate limits, production terms, and which projection/news endpoints are safe to depend on.
- [ ] DraftSharks - Returns: rankings, SOS, bye weeks, D/ST, matchup data, and possibly projections. Used now: source research only. Could power later: bye-week navigation, streamer planning, matchup reads, and schedule-strength tooling. Open questions: partner/API access and whether the public pages stay stable enough to trust.
- [ ] KeepTradeCut - Returns: trade-database rows, market values, and source metadata where available. Used now: trade/value research. Could power later: dynasty trade comps and market trend views. Open questions: whether access is stable without scraping and whether there is a supported data path.
- [ ] Flock Fantasy - Returns: exposure counts, league-share data, and player ranking rows. Used now: dynasty/rookie source research. Could power later: portfolio exposure and roster concentration. Open questions: whether the exposure feed is stable enough to ingest.
- [ ] FantasyCalc - Returns: dynasty/redraft value rows and source metadata. Used now: blended-value inputs and confidence support. Could power later: value trend and comparison views. Open questions: refresh cadence and source coverage details.
- [ ] Dynasty Nerds - Returns: dynasty, rookie, and format-specific ranking rows. Used now: dynasty and rookie blending. Could power later: format-specific rookie draft reads. Open questions: coverage by format and source freshness.
- [ ] Fantasy Nerds - Returns: rankings, projections, or diagnostic rows if available. Used now: source-coverage checks. Could power later: redraft projections and validation. Open questions: which endpoints are current and supported.
- [ ] DynastyProcess - Returns: calculator outputs, dynasty values, and trade context. Used now: dynasty value blending. Could power later: trade comparison and roster value explanation. Open questions: which calculator outputs are stable and current.
- [ ] Prospect Archive / NFL Draft Buzz - Returns: prospect rankings, scouting notes, draft year, college, team, and image/logo fields. Used now: devy and rookie prospect handling. Could power later: scouting detail cards and prospect comparison. Open questions: source freshness and image/logo consistency.
- [ ] ESPN prospect metadata - Returns: player/team/college/external ID fields. Used now: cross-source identity matching. Could power later: better prospect/player normalization. Open questions: which IDs are reliable enough to treat as canonical.
- [ ] Internal snapshots/jobs - Returns: historical values, source-health events, league snapshots, and draft records. Used now: trend analysis, backfills, diagnostics, and confidence calibration. Could power later: anomaly detection and source-history dashboards. Open questions: which historical jobs still need backfill or retention tuning.
- [ ] Add a shortlist of features we already have enough data to build from current sources:
  - [ ] News-to-value movement analysis using FantasyPros/Sleeper news, injury, and snapshot timing.
  - [ ] ADP vs value-over-cost views using FantasyPros ADP / DYNADP / RKADP plus current value blends.
  - [ ] Rookie and devy prospect comparison views using the existing prospect and ranking sources.
  - [ ] Cross-league exposure, concentration, and roster-share reporting from stored league snapshots.
  - [ ] Waiver and trade calibration dashboards from historical outcomes and manager-league history.
  - [ ] Player source trace views that show which feeds are contributing to a player's current value or confidence.

## May 14, 2026 - Projections / SOS Rollout

- [ ] Confirm the approved source blend for projections, strength of schedule, and bye-week data before wiring any feature to live inputs.
- [ ] Compare DraftSharks and FantasyPros as the long-term rankings/SOS source blend before raising trust weights for either one.
- [ ] Populate `schedulePlanning` from the schedule-release data so roster gaps, streamer candidates, and bye-window coverage have real source-backed inputs.
- [ ] Wire schedule-aware inputs into matchup preview so weekly win odds, opponent edge, and "how you win" reads can use projection and SOS context.
- [ ] Wire schedule-aware inputs into player detail views so bye windows, SOS tiers, and schedule summaries are visible at the player level.
- [ ] Wire schedule-aware inputs into weekly autopilot planning so streamer suggestions, roster gaps, and priority actions reflect byes and SOS.
- [ ] Wire schedule-aware inputs into D/ST and matchup-streamer logic so upcoming schedule strength can influence start/sit and pickup decisions.
- [ ] Wire projections into lineup-strength, redraft valuation, and confidence calculations only after validating source freshness and endpoint stability.
- [ ] Add source-health checks and freshness checks for every projection/SOS feed we plan to depend on.
- [ ] Add tests for schedule normalization, bye-window rendering, streamer candidate generation, and planner output from real schedule inputs.
- [ ] Leave a clear fallback state for pre-schedule and missing-data periods so offseason views remain stable.

## FantasyPros Integration Roadmap

- [ ] Store the FantasyPros key only in server env as `FANTASYPROS_API_KEY`, keep it out of source control/client bundles/logs, and document the production deployment step.
- [ ] Confirm FantasyPros production terms, rate limits, and non-commercial restrictions before making it a primary valuation source.
- [x] Add source-health checks for every FantasyPros endpoint we plan to depend on, including row counts, last updated date, expert count, and rate-limit/error status.
- [x] Add separate feature flags for FantasyPros sub-sources so `DRAFT`, `ROS`, `DYNASTY`, `DEVY`, `ROOKIES`, `ADP`, projections, injuries, news, and player-points can be rolled out or disabled independently.
- [x] Add a safe FantasyPros smoke/diagnostics command that checks planned endpoints and prints only status, row counts, freshness, expert counts, and errors, never the API key or raw payload.
- [x] Expand the FantasyPros client to support all useful NFL ranking types: `DRAFT`, `ROS`, `DYNASTY`, `DEVY`, `ROOKIES`, `ADP`, `DYNADP`, and `RKADP` where available.
- [x] Wire FantasyPros `DYNASTY` rankings into the dynasty valuation blend as a true dynasty source with its own adaptive trust weight, separate from redraft/season values.
- [x] Wire FantasyPros `DEVY` rankings into the devy/prospect blend and compare against Flock, KTC Devy, and Prospect Archive before raising its weight.
- [ ] Wire FantasyPros `ROOKIES` rankings into rookie/prospect valuations and rookie draft decision reads.
- [ ] Wire FantasyPros `ADP`, `DYNADP`, and `RKADP` into draft-cost context, value-over-cost reads, and admin source diagnostics.
- [ ] Keep FantasyPros `DRAFT` and `ROS` rankings in the redraft/current-season space only, with scoring-aware `PPR`, `HALF`, and `STD` profiles.
- [ ] Add FantasyPros projections after validating the endpoint under normal rate limits; use weekly, preseason, and rest-of-season projections for lineup strength, matchup preview, and redraft valuation support.
- [ ] Use FantasyPros player-points history to validate prior-season production, weekly consistency, and value-confidence calibration.
- [ ] Use FantasyPros injuries and practice-report probabilities in player availability, lineup risk, and AI confidence notes.
- [ ] Use FantasyPros news categories for player-specific news, injury, transaction, rumor, and breaking-news context, then connect news timestamps to value movement when snapshots overlap.
- [ ] Normalize or enrich `latestNews.url` from upstream news payloads so the player modal's latest-news card stays clickable whenever the source provides a link.
- [ ] Use FantasyPros player IDs and external IDs to improve cross-source identity matching for ESPN, Yahoo, MFL, Fleaflicker, Fantrax, NFL, CBS, DraftKings, and other platform IDs.
- [ ] Add expert metadata and expert publication timestamps to admin diagnostics so stale or thin expert sets lower source trust automatically.
- [ ] Evaluate the FantasyPros compare-players endpoint for player modal context and trade comparison explainers.
- [ ] Add cache/rate-limit protection for FantasyPros calls so report generation does not hammer the API during refresh jobs.
- [x] Add admin-only visibility for FantasyPros endpoint coverage, effective weights, trust movement, stale data, and high-impact valuation changes.
- [ ] Add FantasyPros to the per-player source trace UI so admins can see exactly whether `DRAFT`, `ROS`, `DYNASTY`, `DEVY`, ADP, news, injuries, or player-points affected a player read.
- [ ] Add unit tests for each FantasyPros payload normalizer and integration tests for dynasty, redraft, devy, rookie, ADP, injury, news, projection, and player-points diagnostics.

## Draft Baseline / League Mode Roadmap

- [ ] After deployment, run the expanded production smoke checks for all four target leagues: `Skids Get Beat`, `The Fantasy Degenerates`, `test league`, and `Gov Tech Grid Iron`.
- [ ] Re-check weekly risers and fallers on May 14 or May 15, 2026 after the temporary May 7 baseline floor ages out of the 7-day lookback.
- [ ] If extreme weekly percentages still appear after the 7-day lookback catches up, investigate source volatility, tiny baseline/current values, and source identity mismatches.
- [ ] Keep 2026 rookie draft labels as `Early Riser` and `Early Faller` through preseason, then switch to `Hit` and `Miss` when the season evaluation window opens.
- [ ] Add an admin-only weekly movement anomaly report for extreme movers, low-denominator baselines, and suspicious source swings.

## Waiver / Trade Intelligence Roadmap

- [ ] Review waiver `won/lost` and trade `acted/blocked` outcomes after enough real samples accumulate, then tune confidence weights against actual results.
- [ ] Add an admin accuracy panel for prediction quality by module: waiver bid range, waiver competition, trade resistance, and depth-chart role confidence.
- [ ] Add historical Sleeper backfill observability showing scanned league IDs, transaction counts, seasons loaded, failures, and broken `previous_league_id` chains.
- [ ] Add depth-chart cache health diagnostics showing last warm time, loaded teams, failed teams, retry count, and stale team coverage.
- [ ] Move recommendation outcome detection into a backend job so confidence can improve even when the user does not reopen the report UI.
- [ ] Remove the legacy `trade-recommendation-outcomes:v1` localStorage migration read after shared action-plan storage has been live long enough.

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
- [ ] Add server-side matchup ingestion to populate `ReportData.matchupPreviews`.
- [ ] Keep the schedule-pending empty state for offseason and pre-schedule periods.

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
- [ ] Add `FANTASY_NERDS_API_KEY` to production env after confirming the live package returns current-season rows, then verify Fantasy Nerds redraft and dynasty diagnostics load cleanly.
- [ ] Revisit GridIron Data once a key or package is available and decide whether it belongs in redraft projections, player news, or source health only.
- [ ] Revisit MySportsFeeds if they approve access, and keep it out of the blend until endpoint coverage and licensing are confirmed.
- [ ] Add source and status diagnostics when news payloads are unavailable.
- [ ] Add value-movement-after-news analysis when news timestamps and value snapshots overlap.
- [ ] Add role and depth-chart change detection when reliable source data exists.

### Command Center Polish
- [ ] Add deeper mobile QA for all premium cards after real matchup data lands.
- [ ] Add E2E coverage for admin-only feature visibility.
- [ ] Add E2E coverage for local watch preference persistence.
- [ ] Add E2E coverage for portfolio snapshot persistence.
- [ ] Add E2E coverage for blueprint print and share controls where practical.

## Report UX / Tooling Roadmap

### ReportTables Split - Remaining Work
- [ ] Split `TradeWarRoom` out of `client/src/components/ReportTables.tsx` into a real lazy-loaded module.
- [ ] Split `TradeHistoryTable` out of `client/src/components/ReportTables.tsx` into a real lazy-loaded module.
- [ ] Split `TradeProfitLeaderboardTable` out of `client/src/components/ReportTables.tsx` into a real lazy-loaded module.
- [ ] Keep shared trade/value helpers centralized so split modules do not duplicate logic.
- [ ] Run typecheck, unit tests, build, and focused e2e after each split.

### Dirty Worktree Reconciliation
- [ ] Separate report UX and tooling changes from unrelated auth, OAuth, and server cleanup changes before committing.
- [ ] Review deleted auth and server files and confirm each deletion is intentional.
- [ ] Review docs and todo changes separately from runtime code changes.
- [ ] Keep `server/dynastySourceTrust.ts` and `server/valueBlend.ts` cleanup isolated from report UX work so typecheck fixes stay easy to verify.
- [ ] Refresh the redraft trade-ledger screenshot regression whenever that UI is touched again.
- [ ] Stage the final commit in logical groups instead of one mixed worktree commit.

### Production Smoke After Deploy
- [ ] After deployment, run the manual `Production Smoke` GitHub workflow against `https://dynastydegens.com`.
- [ ] Verify dynasty leagues `Skids Get Beat` and `The Fantasy Degenerates` still render dynasty copy, draft capital and main draft surfaces, rookie draft surfaces, and trade-value context correctly.
- [ ] Verify redraft leagues `test league` and `Gov Tech Grid Iron` still avoid dynasty-first copy and prioritize current-season values.
- [ ] Confirm internal draft baseline comparison dates are not exposed in the deployed report UI.
- [ ] Confirm deployed console logs do not show app errors on desktop or mobile.

### Bundle Cleanup
- [ ] Use `pnpm run build:analyze` to inspect `dist/bundle-stats.html` before the next performance pass.
- [ ] Reduce the remaining large `RecentTransactionsPanel` lazy chunk.
- [ ] Check whether shared helpers pulled from `ReportTables.tsx` keep too much code in downstream chunks.
- [ ] Consider extracting trade-ledger helpers into a non-React utility module once `TradeHistoryTable` and `TradeWarRoom` are split.
