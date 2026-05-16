# Todo Execution Notes - 2026-05-15 Evening

Scope: process `todo.md` top to bottom after the player-enrichment cache work. Premium UI and Three.js polish are intentionally out of scope per request.

When this pass is done, ask Billy whether he wants the full summary. If he says yes, summarize from this file plus the commits pushed during the pass, including value-blend changes, provider/snapshot changes, new backend features, validation, blocked items, and deferred premium UI/Three.js work.

## Completed During This Pass

| Area | Result | Files |
| --- | --- | --- |
| Report payload slimming regression coverage | Confirmed recursive transfer slimming covers the named hotspot sections: `managerRosterIntelligence`, `managerPositionCounts`, `draftPicks`, and trade-table-like nested player rows. Added a regression test so repeated embedded `playerDetails` in those sections stay compact when `playerDetailsById` is the canonical full detail source. | `server/reportPayloadSlimming.test.ts` |
| Projection/SOS source policy | Documented the approved schedule/projection boundary: Sleeper current-state can be live on user load; NFL bye weeks are static; DraftSharks SOS must be stored snapshot data from approved partner access; FantasyPros projections remain blocked for paid/public use until terms and rate limits are approved. | `docs/projections-sos-source-policy.md`, `todo.md` |
| Schedule-aware matchup previews | `buildMatchupPreviews` now accepts stored player schedule profiles and applies a bounded bye/SOS adjustment to projection-style matchup estimates, win probability, position-edge notes, and how-to-win copy. `league.analyze` passes cached player schedule profiles into matchup preview generation. | `server/schedulePlanning.ts`, `server/routers.ts`, `server/schedulePlanning.test.ts` |
| External source probe refresh | Ran `pnpm run probe:external-sources` and recorded metadata-only results for Yahoo, Sleeper, OpticOdds, SportsGameOdds, ParlayAPI, Underdog, bet365, FFPC, and Fantrax. No payloads or secrets were printed. | `docs/external-source-probe.md`, `todo.md` |
| Props compliance boundaries | Added responsible-gaming and product-language boundaries for public props UI. Internal intelligence can use generic market-signal language while avoiding direct betting recommendations. | `docs/props-compliance-boundaries.md`, `todo.md` |
| Player cohort signal engine | Added a pure backend cohort engine that reads stored `playerDetailsById` only. It creates QB/RB/WR/TE age phases, production scores, market scores, market-vs-production deltas, first-pass outcome buckets, confidence scores, peer rows, and explanation traces. | `server/playerCohortEngine.ts`, `server/playerCohortEngine.test.ts`, `todo.md` |
| Overview readout ownership | Added the Overview ownership matrix so every surface has one job, allowed readouts, banned overlap, and a source-of-truth owner. Also assigned ownership for repeated concepts like league value rank, starter room, bench depth, trade partner fit, and taxi calls. | `docs/overview-readout-ownership.md`, `todo.md` |
| Monetization/auth plan | Defined the low-friction public funnel, first pricing tiers, passwordless auth direction, Stripe billing direction, first entitlement map, future billing tables, required tests, and external blockers. | `docs/monetization-auth-plan.md`, `todo.md` |
| FantasyPros normalizer coverage | Added regression coverage for `ROOKIES`, `ADP`, and upstream news URL normalization. Confirmed the existing client keeps FantasyPros calls cached and cron/admin-scoped rather than report-load live provider work. | `server/fantasyPros.test.ts`, `todo.md` |
| Weekly movement anomaly report | Added `pnpm audit:weekly-movement`, which compares stored value snapshots and prints only player metadata, value deltas, source names, and anomaly reasons for extreme moves, low-denominator baselines, and source-set changes. Local run compared 735 players from `2026-05-11` vs `2026-05-07` and found 204 anomaly candidates. | `server/weeklyMovementAnomalyReport.ts`, `server/weeklyMovementAnomalyReport.test.ts`, `docs/weekly-movement-anomaly-report.md`, `package.json`, `todo.md` |
| Weekly movement production DB audit | Added `--source=db` support to `pnpm audit:weekly-movement` and ran it against production snapshots. The 12-team SF PPR profile compared `2026-05-15` current values against the `2026-05-08` baseline, covered 739 players, and found 221 anomaly candidates. The largest flags are low-baseline prospect jumps and source-set changes after broader source coverage. | `server/weeklyMovementAnomalyReport.ts`, `docs/weekly-movement-anomaly-report.md`, `todo.md` |
| Depth-chart cache health diagnostics | Expanded ESPN depth-chart diagnostics with cache mode, snapshot key, last warm time, snapshot update time, stale/missing team count, and retry count. Admin diagnostics now include snapshot/cache context in the role-coverage note. | `server/espnDepthCharts.ts`, `shared/types.ts`, `client/src/pages/Home.tsx`, `server/espnDepthCharts.test.ts`, `todo.md` |
| Historical Sleeper backfill observability | Expanded transaction backfill diagnostics with scanned league IDs, per-league status, previous-league links, failed league IDs, failure counts, and broken-chain counts so admin diagnostics can separate healthy history from missing or failed Sleeper history links. | `server/routers.ts`, `shared/types.ts`, `client/src/pages/Home.tsx`, `todo.md` |
| Rookie-only dynasty draft capital efficiency | Scoped dynasty Draft Capital Efficiency stats and manager modal drilldowns to rookie draft picks only. Full draft boards still keep startup/main draft rows where appropriate, and redraft recap efficiency still uses main-draft picks. | `server/draftAnalysis.ts`, `server/draftAnalysis.test.ts`, `client/src/components/DraftAnalysis.tsx` |

## Deferred By Request

- Premium Owner Intel / AI Tron readout polish.
- Three.js loading/report-generated modal rebuild.
- `SuccessTakeover` Three.js/mobile fallback work.
- Three.js report shell, player moments, intelligence reveals, and source-health cockpit concepts.

## Blocked / Needs External Action

| Item | Why Blocked | Next Action |
| --- | --- | --- |
| Production `SOURCE_HEALTH_ALERT_WEBHOOK_URL` configuration | Runtime support already exists in `server/sourceHealth.ts`, `.env.example`, and docs, but the actual production webhook secret must be set in the deployment secret store. | Add the Slack/email/webhook URL in production env and choose `SOURCE_HEALTH_ALERT_WEBHOOK_MIN_LEVEL`. |
| Projection-driven lineup strength/value changes | The current safe schedule layer is bye/SOS-aware, but first-class weekly projection valuation should wait for approved projection snapshots with source/version metadata. | Keep FantasyPros projections blocked until commercial terms/rate limits are approved, then add snapshot-backed projection fields and validation. |
| Real props rollout | OpticOdds, SportsGameOdds, and ParlayAPI all need API keys before real props rows can be stored. | After key approval, configure server/prod env, run dynamic-data refresh, and audit row count, payload size, sportsbook coverage, and market coverage. |
| Historical/backtested cohort modeling | The new cohort engine is a deterministic first pass over current stored report/player details. It is not yet a season-by-season historical warehouse or backtest. | Expand source-history retention and run historical seasons through the engine before treating buckets as calibrated model outputs. |
| Overview copy cleanup and duplicate regression | The ownership matrix is complete, but the UI copy has not yet been rewritten surface-by-surface and there is no duplicate-story snapshot test yet. | Use `docs/overview-readout-ownership.md` during the next Overview logic/UI pass, then add a regression check. |
| Billing/auth implementation | Pricing and architecture are documented, but email provider, Stripe products/prices, webhook secret, and legal pages are not configured yet. | Implement magic-link auth, Stripe tables, webhooks, entitlements, usage limits, and legal pages after product/provider decisions are final. |
| Weekly movement anomaly cleanup | The production DB recheck is complete and confirms extreme rows still exist, mostly due to low baseline values and source-set changes. | Investigate whether weekly momentum should exclude tiny baseline prospects, separate draft-pick assets from player rows, or require stable source-set coverage before surfacing extreme percentages. |
